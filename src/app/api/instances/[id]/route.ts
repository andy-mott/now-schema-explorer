import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, url, username, password } = body;

  if (!name || !url || !username) {
    return NextResponse.json(
      { error: "Name, URL, and username are required" },
      { status: 400 }
    );
  }

  // Extract just the origin (protocol + hostname) in case user pastes a full URL
  let cleanUrl: string;
  try {
    cleanUrl = new URL(url).origin;
  } catch {
    return NextResponse.json(
      { error: "Invalid URL format" },
      { status: 400 }
    );
  }

  const data: Record<string, string> = {
    name,
    url: cleanUrl,
    username,
  };

  // Only update password if a new one is provided
  if (password) {
    data.encryptedPassword = password; // TODO: encrypt
  }

  const instance = await prisma.serviceNowInstance.update({
    where: { id },
    data,
  });

  return NextResponse.json(instance);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.serviceNowInstance.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
