import { NextResponse } from "next/server";
import { consumeEmailVerificationToken, markEmailVerified } from "@/lib/auth-tokens";
import { hashToken } from "@/lib/auth";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (!token) {
            return NextResponse.json({ error: "الرمز مطلوب" }, { status: 400 });
        }

        const result = await consumeEmailVerificationToken(token);
        if (!result) {
            return NextResponse.json({ error: "رمز التحقق غير صالح أو منتهي الصلاحية" }, { status: 400 });
        }

        await markEmailVerified(result.userId, hashToken(token));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Verify email error:", error);
        return NextResponse.json({ error: "حدث خطأ أثناء التحقق من البريد الإلكتروني" }, { status: 500 });
    }
}
