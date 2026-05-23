import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0f172a", padding:"20px" }}>
          <div style={{ maxWidth:"480px", width:"100%", textAlign:"center" }}>
            <div style={{ fontSize:"48px", marginBottom:"16px" }}>⚠️</div>
            <h1 style={{ color:"#f1f5f9", fontSize:"20px", fontWeight:"700", marginBottom:"8px" }}>Something went wrong</h1>
            <pre style={{ color:"#f87171", fontSize:"12px", background:"#1e293b", padding:"12px", borderRadius:"8px", textAlign:"left", overflowX:"auto", marginBottom:"16px", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>
              {this.state.error.stack || this.state.error.message}
            </pre>
            <button
              onClick={() => { this.setState({ error: null }); window.location.href = "/"; }}
              style={{ padding:"8px 20px", borderRadius:"8px", background:"#3b82f6", color:"#fff", fontSize:"14px", fontWeight:"600", border:"none", cursor:"pointer" }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
