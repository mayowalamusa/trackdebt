import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";

export const Route = createFileRoute("/input-test")({
  component: InputTest,
});

function InputTest() {
  const [value, setValue] = React.useState("");

  return (
    <div
      style={{
        padding: "30px",
        minHeight: "100vh",
        background: "white",
        color: "black",
      }}
    >
      <h1>Track Debt Input Test</h1>

      <p>Type in the fields below.</p>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type here"
        style={{
          width: "100%",
          padding: "15px",
          fontSize: "18px",
          border: "1px solid black",
          boxSizing: "border-box",
        }}
      />

      <p>
        <strong>You typed:</strong> {value}
      </p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Textarea test"
        style={{
          width: "100%",
          height: "100px",
          marginTop: "20px",
          padding: "15px",
          fontSize: "18px",
          border: "1px solid black",
          boxSizing: "border-box",
        }}
      />
    </div>
  );
}