import React, { useRef, useState } from "react";

interface DropZoneProps {
  onFileSelected: (file: File) => void;
}

export default function DropZone({ onFileSelected }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  }

  const containerStyle: React.CSSProperties = {
    border: `2px dashed ${dragging ? "#3b82d4" : "#d1d5db"}`,
    borderRadius: "8px",
    padding: "2.5rem 1.5rem",
    textAlign: "center",
    backgroundColor: dragging ? "#eff6ff" : "#f7f8fa",
    transition: "border-color 0.15s, background-color 0.15s",
    cursor: "default",
  };

  const promptStyle: React.CSSProperties = {
    color: "#57606a",
    fontSize: "15px",
    marginBottom: "0.75rem",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "0.4rem 1rem",
    fontSize: "14px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    backgroundColor: "#ffffff",
    cursor: "pointer",
    color: "#1f2328",
  };

  return (
    <div
      style={containerStyle}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p style={promptStyle}>Drag &amp; drop a file here, or</p>
      <button style={buttonStyle} onClick={() => inputRef.current?.click()}>
        Browse files
      </button>
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleInputChange}
      />
    </div>
  );
}
