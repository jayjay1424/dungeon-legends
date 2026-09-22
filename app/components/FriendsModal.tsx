"use client";

import { useEffect, useState } from "react";
import {
  getFriends,
  sendFriendRequest,
  removeFriend,
  type FriendItem,
} from "@/app/actions/friends";

interface FriendsModalProps {
  onClose: () => void;
  currentRoomId?: string | null;
  onInvite?: (friendName: string) => void;
}

export default function FriendsModal({
  onClose,
  currentRoomId,
  onInvite,
}: FriendsModalProps) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadList();
  }, []);

  const loadList = async () => {
    setLoading(true);
    const list = await getFriends();
    setFriends(list);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim() || submitting) return;
    setSubmitting(true);
    setMessage("");
    const res = await sendFriendRequest(usernameInput);
    setMessage(res.message);
    setSubmitting(false);
    if (res.success) {
      setUsernameInput("");
      loadList();
    }
  };

  const handleRemove = async (friendId: string) => {
    await removeFriend(friendId);
    setFriends((prev) => prev.filter((f) => f.friendId !== friendId));
  };

  const handleInvite = (friend: FriendItem) => {
    if (currentRoomId) {
      const inviteUrl = `${window.location.origin}/survival?room=${currentRoomId}`;
      navigator.clipboard.writeText(inviteUrl);
      setMessage(`Invite link for room ${currentRoomId.slice(0, 8)} copied!`);
    } else {
      setMessage("Create or join a room first to invite friends!");
    }
    onInvite?.(friend.username);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 11000000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(5, 5, 8, 0.8)",
        backdropFilter: "blur(4px)",
        fontFamily: 'var(--font-pixel), "Press Start 2P", monospace',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(440px, 94vw)",
          background: "rgba(24, 20, 37, 0.98)",
          border: "4px solid #3a3f58",
          outline: "4px solid #000",
          boxShadow: "0 0 0 8px rgba(24, 20, 37, 0.98), 0 16px 36px rgba(0, 0, 0, 0.95)",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "3px solid #3a3f58",
            paddingBottom: 8,
          }}
        >
          <h2
            style={{
              margin: 0,
              color: "#ffcd75",
              fontSize: "0.82rem",
              letterSpacing: "0.12em",
              textShadow: "2px 2px #5a1111",
            }}
          >
            👥 FRIENDS
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#b13434",
              border: "2px solid #ffcd75",
              color: "#fff",
              cursor: "pointer",
              padding: "4px 8px",
              fontFamily: "inherit",
              fontSize: "0.6rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* Add Friend Form */}
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Enter friend username..."
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            style={{
              flex: 1,
              background: "#0f0a1e",
              border: "2px solid #3a3f58",
              color: "#ffcd75",
              padding: "6px 8px",
              fontSize: "0.58rem",
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            disabled={submitting || !usernameInput.trim()}
            style={{
              background: "#38bdf8",
              border: "2px solid #0284c7",
              color: "#0f172a",
              fontWeight: 800,
              padding: "6px 12px",
              fontSize: "0.58rem",
              cursor: submitting || !usernameInput.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {submitting ? "ADDING..." : "+ ADD"}
          </button>
        </form>

        {message && (
          <div
            style={{
              padding: "5px 8px",
              background: "rgba(56, 189, 248, 0.15)",
              border: "1px solid #38bdf8",
              color: "#38bdf8",
              fontSize: "0.55rem",
              lineHeight: 1.4,
            }}
          >
            {message}
          </div>
        )}

        {/* Friends List */}
        <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {loading ? (
            <div style={{ color: "#a0a5c0", fontSize: "0.58rem", textAlign: "center", padding: 16 }}>
              Loading adventurers...
            </div>
          ) : friends.length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "0.58rem", textAlign: "center", padding: 20 }}>
              No friends added yet. Type a friend&apos;s username above to add them!
            </div>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.friendId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "rgba(15, 10, 30, 0.8)",
                  border: "1px solid #3a3f58",
                  padding: "6px 8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: friend.isOnline ? "#4ade80" : "#6b7280",
                      boxShadow: friend.isOnline ? "0 0 6px #4ade80" : "none",
                    }}
                  />
                  <div>
                    <strong style={{ color: "#ffcd75", fontSize: "0.62rem" }}>
                      {friend.username}
                    </strong>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleInvite(friend)}
                    style={{
                      background: "#0284c7",
                      border: "1px solid #38bdf8",
                      color: "#fff",
                      fontSize: "0.52rem",
                      padding: "4px 8px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    INVITE
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(friend.friendId)}
                    style={{
                      background: "transparent",
                      border: "1px solid #f43f5e",
                      color: "#f43f5e",
                      fontSize: "0.52rem",
                      padding: "4px 6px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                    title="Remove friend"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

