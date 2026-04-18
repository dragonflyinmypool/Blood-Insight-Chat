import { Router, type IRouter } from "express";
import { eq, asc, desc } from "drizzle-orm";
import { db, chatConversationsTable, chatMessagesTable, bloodTestsTable, bloodTestResultsTable } from "@workspace/db";
import {
  CreateChatConversationBody,
  GetChatConversationParams,
  DeleteChatConversationParams,
  ListChatMessagesParams,
  SendChatMessageParams,
  SendChatMessageBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { OPENAI_MODEL } from "../lib/openaiModel";

const router: IRouter = Router();

async function buildSystemPrompt(bloodTestId: number | null | undefined): Promise<string> {
  let contextText = "";

  if (bloodTestId) {
    const [test] = await db
      .select()
      .from(bloodTestsTable)
      .where(eq(bloodTestsTable.id, bloodTestId));

    if (test) {
      const results = await db
        .select()
        .from(bloodTestResultsTable)
        .where(eq(bloodTestResultsTable.bloodTestId, bloodTestId));

      contextText = `\n\nYou have access to the following blood test results from ${test.testDate ?? "an unknown date"}:
Lab: ${test.labName ?? "Unknown"}
Patient: ${test.patientName ?? "Unknown"}

Markers:
${results.map((r) => `- ${r.markerName}: ${r.value ?? "N/A"} ${r.unit ?? ""} (ref: ${r.referenceRangeLow ?? "?"}-${r.referenceRangeHigh ?? "?"}) - Status: ${r.status ?? "unknown"}`).join("\n")}`;
    }
  } else {
    const allTests = await db
      .select()
      .from(bloodTestsTable)
      .orderBy(desc(bloodTestsTable.createdAt))
      .limit(5);

    if (allTests.length > 0) {
      const testSummaries = await Promise.all(
        allTests.map(async (test) => {
          const results = await db
            .select()
            .from(bloodTestResultsTable)
            .where(eq(bloodTestResultsTable.bloodTestId, test.id));
          return `Test from ${test.testDate ?? "unknown date"} (${results.length} markers)`;
        })
      );
      contextText = `\n\nThe user has the following blood tests on record:\n${testSummaries.join("\n")}`;
    }
  }

  return `You are a knowledgeable and empathetic health assistant specializing in interpreting blood test results. 
You help users understand their lab results, explain what markers mean, identify trends, and provide general health guidance.
Always remind users to consult with their healthcare provider for medical decisions.
Be clear, accurate, and reassuring.${contextText}`;
}

router.get("/chat/conversations", async (_req, res): Promise<void> => {
  const conversations = await db
    .select()
    .from(chatConversationsTable)
    .orderBy(desc(chatConversationsTable.createdAt));
  res.json(conversations);
});

router.post("/chat/conversations", async (req, res): Promise<void> => {
  const parsed = CreateChatConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conversation] = await db
    .insert(chatConversationsTable)
    .values({
      title: parsed.data.title,
      bloodTestId: parsed.data.bloodTestId ?? null,
    })
    .returning();

  res.status(201).json(conversation);
});

router.get("/chat/conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetChatConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(chatConversationsTable)
    .where(eq(chatConversationsTable.id, params.data.id));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, params.data.id))
    .orderBy(asc(chatMessagesTable.createdAt));

  res.json({ ...conversation, messages });
});

router.delete("/chat/conversations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteChatConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(chatConversationsTable)
    .where(eq(chatConversationsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListChatMessagesParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, params.data.id))
    .orderBy(asc(chatMessagesTable.createdAt));

  res.json(messages);
});

router.post("/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SendChatMessageParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const bodyParsed = SendChatMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [conversation] = await db
    .select()
    .from(chatConversationsTable)
    .where(eq(chatConversationsTable.id, params.data.id));

  if (!conversation) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(chatMessagesTable).values({
    conversationId: params.data.id,
    role: "user",
    content: bodyParsed.data.content,
  });

  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.conversationId, params.data.id))
    .orderBy(asc(chatMessagesTable.createdAt));

  const systemPrompt = await buildSystemPrompt(conversation.bloodTestId);

  const chatMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const stream = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(chatMessagesTable).values({
    conversationId: params.data.id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
