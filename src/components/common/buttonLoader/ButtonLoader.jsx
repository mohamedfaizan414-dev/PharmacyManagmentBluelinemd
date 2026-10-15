import React from "react";

export default function ButtonLoader({ label = "Signing In..." }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
      <span className="login-spinner" />
      <span>{label}</span>
    </span>
  );
}
