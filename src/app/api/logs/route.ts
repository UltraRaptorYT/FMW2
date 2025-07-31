import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only
);

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { error } = await supabase.from("fmw2_logs").insert([
    {
      template: body.template,
      fields: body.fields,
      user_agent: body.user_agent,
    },
  ]);

  if (error) {
    return NextResponse.json({ success: false, error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
