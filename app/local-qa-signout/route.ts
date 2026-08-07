import { NextRequest, NextResponse } from "next/server";
import {
  chatGPTSignOutPath,
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
    return NextResponse.redirect(new URL(chatGPTSignOutPath(returnTo, request.headers), request.url));
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url));
  response.cookies.delete(LOCAL_QA_COOKIE);
  return response;
}
