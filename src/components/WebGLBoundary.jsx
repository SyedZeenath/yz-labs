import { Component } from "react";

// Wraps the 3D hero canvas. If WebGL context creation or anything inside
// the Canvas throws (unsupported GPU, driver blocklist, texture load
// failure), this swallows it and renders `fallback` instead of taking the
// whole page down with it — the hero degrades to a flat image rather than
// a blank crash.
export default class WebGLBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn("3D hero failed, falling back to static visual:", error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}

export function supportsWebGL() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}
