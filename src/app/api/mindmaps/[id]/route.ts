import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/mindmaps/[id]
 *
 * 儲存使用者在 React Flow 畫布上編輯後的節點/邊資料。
 * RLS 的 update policy（auth.uid() = user_id）確保只有本人能改自己的 Mind Map。
 */

const nodeSchema = z.object({
  id: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    kind: z.enum(["root", "star", "keywords", "keyword"]),
    fullText: z.string().optional(),
  }),
});

const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

const requestSchema = z.object({
  reactFlowData: z.object({
    nodes: z.array(nodeSchema).min(1),
    edges: z.array(edgeSchema),
  }),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "請先登入" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("mind_maps")
    .update({ react_flow_data: parsed.data.reactFlowData })
    .eq("id", id);

  if (error) {
    console.error("[mindmaps] update failed:", error);
    return NextResponse.json({ error: "儲存失敗" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
