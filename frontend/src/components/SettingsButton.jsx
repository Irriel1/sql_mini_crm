import { href } from "react-router-dom";

export default function SettingsButton({ onClick, title = "Settings" }) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label="Open settings"
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: "white",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>⚙️</span>
      </button>
    );
  }
  