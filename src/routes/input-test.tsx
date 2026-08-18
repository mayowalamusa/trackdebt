import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/input-test")({
  component: InputTest,
});

function InputTest() {
  React.useEffect(() => {
    console.log("[TRACK-DEBT-DIAG] InputTest Mounted");
    return () => console.log("[TRACK-DEBT-DIAG] InputTest Unmounted");
  }, []);

  return (
    <div style={{ padding: "50px", background: "#fff", color: "#000" }}>
      <h1>ISOLATED INPUT TEST</h1>
      <p>This page has NO state and NO effects (other than mounting log).</p>

      <div style={{ marginBottom: "20px" }}>
        <label block>Plain HTML Input:</label>
        <input
          type="text"
          placeholder="Type here..."
          style={{ width: "100%", padding: "10px", border: "1px solid #000" }}
          onFocus={() => console.log("[TRACK-DEBT-DIAG] Plain Input Focus")}
          onBlur={() => console.log("[TRACK-DEBT-DIAG] Plain Input Blur")}
        />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label block>Plain HTML Textarea:</label>
        <textarea
          placeholder="Type here..."
          style={{ width: "100%", height: "100px", padding: "10px", border: "1px solid #000" }}
          onFocus={() => console.log("[TRACK-DEBT-DIAG] Plain Textarea Focus")}
          onBlur={() => console.log("[TRACK-DEBT-DIAG] Plain Textarea Blur")}
        />
      </div>

      <button
        onClick={() => alert("Button works!")}
        style={{ padding: "10px 20px", background: "#000", color: "#fff" }}
      >
        TEST BUTTON
      </button>
    </div>
  );
}
