import { NextRequest, NextResponse } from "next/server";
import {
  chatGPTSignInPath,
  LOCAL_QA_COOKIE,
  localPreviewAuthEnabled,
  safeAuthReturnPath,
} from "@/app/chatgpt-auth";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest): NextResponse {
  const returnTo = safeAuthReturnPath(
    request.nextUrl.searchParams.get("return_to") ?? "/v3",
  );

  if (!localPreviewAuthEnabled(request.headers)) {
    return NextResponse.redirect(new URL(chatGPTSignInPath(returnTo, request.headers), request.url));
  }

  const existingId = request.cookies.get(LOCAL_QA_COOKIE)?.value;
  const localId =
    existingId && /^[a-zA-Z0-9-]{8,64}$/.test(existingId)
      ? existingId
      : crypto.randomUUID();
  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.set(LOCAL_QA_COOKIE, localId, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: false,
  });
  return response;
}
