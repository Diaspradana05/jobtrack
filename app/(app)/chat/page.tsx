import type { Metadata } from "next";
import ChatClient from "@/components/ChatClient";

export const metadata: Metadata = { title: "AI Assistant" };

export default function ChatPage() {
  return <ChatClient />;
}
