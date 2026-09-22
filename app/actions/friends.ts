// Server actions for Friends System
"use server";

import { createClient } from "@/utils/supabase/server";

export type FriendItem = {
  id: string;
  friendId: string;
  username: string;
  level: number;
  status: "accepted" | "pending";
  isOnline?: boolean;
};

export async function getFriends(): Promise<FriendItem[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
      .from("friends")
      .select(`
        id,
        status,
        friend_id,
        profiles:friend_id (username)
      `)
      .eq("user_id", user.id);

    if (error || !data) return [];

    return data.map((item: any) => ({
      id: item.id,
      friendId: item.friend_id,
      username: item.profiles?.username ?? "Adventurer",
      level: 1,
      status: item.status ?? "accepted",
      isOnline: true,
    }));
  } catch {
    return [];
  }
}

export async function sendFriendRequest(
  targetUsername: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanUsername = targetUsername.trim();
    if (!cleanUsername) return { success: false, message: "Please enter a username" };

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { success: false, message: "Not authenticated" };

    // Find target user
    const { data: targetUser, error: findError } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (findError || !targetUser) {
      return { success: false, message: `Hero "${cleanUsername}" not found.` };
    }

    if (targetUser.id === user.id) {
      return { success: false, message: "You cannot add yourself as a friend!" };
    }

    const { error: insertError } = await supabase.from("friends").upsert(
      {
        user_id: user.id,
        friend_id: targetUser.id,
        status: "accepted",
      },
      { onConflict: "user_id,friend_id" }
    );

    if (insertError) {
      return { success: false, message: insertError.message };
    }

    return { success: true, message: `Added ${targetUser.username} as friend!` };
  } catch (err: any) {
    return { success: false, message: err?.message ?? "Failed to add friend." };
  }
}

export async function removeFriend(friendId: string): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return false;

    await supabase
      .from("friends")
      .delete()
      .eq("user_id", user.id)
      .eq("friend_id", friendId);

    return true;
  } catch {
    return false;
  }
}

