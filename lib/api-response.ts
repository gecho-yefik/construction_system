import { NextResponse } from "next/server";

export function createSuccessResponse<T>(
    data: T,
    message: string,
    status = 200,
) {
    return NextResponse.json({ data, message }, { status });
}