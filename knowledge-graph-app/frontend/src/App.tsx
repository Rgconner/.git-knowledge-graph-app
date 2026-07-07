import React from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Knowledge Graph</h1>
      <p>Scaffold is ready. Build your pages in <code>src/pages/</code>.</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
