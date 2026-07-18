"use client";

import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; msg: string };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, msg: "" };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, msg: error?.message || "Unknown error" };
  }

  componentDidCatch(error: any, info: any) {
    console.error("Fokusle ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "#fff", fontFamily: "sans-serif", textAlign: "center" }}>
          <h3 style={{ fontSize: 16 }}>This view hit an error.</h3>
          <p style={{ color: "#9a8fc4", fontSize: 12 }}>{this.state.msg}</p>
          <button
            onClick={() => this.setState({ hasError: false, msg: "" })}
            style={{ background: "#6E54FF", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13, cursor: "pointer" }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
