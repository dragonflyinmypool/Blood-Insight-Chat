import { pgTable, text, serial, timestamp, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bloodTestsTable = pgTable("blood_tests", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  testDate: text("test_date"),
  labName: text("lab_name"),
  patientName: text("patient_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const bloodTestResultsTable = pgTable("blood_test_results", {
  id: serial("id").primaryKey(),
  bloodTestId: integer("blood_test_id").notNull().references(() => bloodTestsTable.id, { onDelete: "cascade" }),
  markerName: text("marker_name").notNull(),
  value: real("value"),
  unit: text("unit"),
  referenceRangeLow: real("reference_range_low"),
  referenceRangeHigh: real("reference_range_high"),
  status: text("status"),
  rawText: text("raw_text"),
});

export const insertBloodTestSchema = createInsertSchema(bloodTestsTable).omit({ id: true, createdAt: true });
export const insertBloodTestResultSchema = createInsertSchema(bloodTestResultsTable).omit({ id: true });

export type InsertBloodTest = z.infer<typeof insertBloodTestSchema>;
export type BloodTest = typeof bloodTestsTable.$inferSelect;
export type InsertBloodTestResult = z.infer<typeof insertBloodTestResultSchema>;
export type BloodTestResult = typeof bloodTestResultsTable.$inferSelect;
