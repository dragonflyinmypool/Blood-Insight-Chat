import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "npm:openai@^4.80.0";
import { corsHeaders } from "../_shared/cors.ts";

const MODEL = Deno.env.get("AI_MODEL") ?? "gpt-4o-mini";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_BASE_URL = Deno.env.get("OPENAI_BASE_URL");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set (supabase/functions/.env)");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL });

type ChatMessageRow = {
  role: "user" | "assistant" | "system";
  content: string;
};

async function buildSystemPrompt(
  supabase: ReturnType<typeof createClient>,
  bloodTestId: number | null
): Promise<string> {
  let contextText = "";

  if (bloodTestId) {
    const { data: test } = await supabase
      .from("blood_tests")
      .select("test_date, lab_name, patient_name")
      .eq("id", bloodTestId)
      .maybeSingle();

    if (test) {
      const { data: results } = await supabase
        .from("blood_test_results")
        .select("marker_name, value, unit, reference_range_low, reference_range_high, status")
        .eq("blood_test_id", bloodTestId);

      contextText = `\n\nYou have access to the following blood test results from ${test.test_date ?? "an unknown date"}:
Lab: ${test.lab_name ?? "Unknown"}
Patient: ${test.patient_name ?? "Unknown"}

Markers:
${(results ?? [])
  .map(
    (r) =>
      `- ${r.marker_name}: ${r.value ?? "N/A"} ${r.unit ?? ""} (ref: ${r.reference_range_low ?? "?"}-${r.reference_range_high ?? "?"}) - Status: ${r.status ?? "unknown"}`
  )
  .join("\n")}`;
    }
  } else {
    const { data: allTests } = await supabase
      .from("blood_tests")
      .select("id, test_date")
      .order("created_at", { ascending: false })
      .limit(5);

    if (allTests && allTests.length > 0) {
      const summaries: string[] = [];
      for (const test of allTests) {
        const { count } = await supabase
          .from("blood_test_results")
          .select("id", { count: "exact", head: true })
          .eq("blood_test_id", test.id);
        summaries.push(`Test from ${test.test_date ?? "unknown date"} (${count ?? 0} markers)`);
      }
      contextText = `\n\nThe user has the following blood tests on record:\n${summaries.join("\n")}`;
    }
  }

  return `You are a knowledgeable and empathetic health assistant specializing in interpreting blood test results.
You help users understand their lab results, explain what markers mean, identify trends, and provide general health guidance.
Always remind users to consult with their healthcare provider for medical decisions.
Be clear, accurate, and reassuring.${contextText}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: { conversationId?: number; content?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { conversationId, content } = body;
  if (!conversationId || !content) {
    return new Response(JSON.stringify({ error: "conversationId and content are required" }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const { data: conversation } = await supabase
    .from("chat_conversations")
    .select("id, blood_test_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    return new Response(JSON.stringify({ error: "Conversation not found" }), {
      status: 404,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content,
  });

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const systemPrompt = await buildSystemPrompt(supabase, conversation.blood_test_id);

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...(history ?? []).map((m: Partial<ChatMessageRow>) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: m.content ?? "",
    })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      try {
        const completion = await openai.chat.completions.create({
          model: MODEL,
          max_completion_tokens: 8192,
          messages,
          stream: true,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
          }
        }

        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullResponse,
        });

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
});
