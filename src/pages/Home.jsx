import { useState, useEffect, useRef } from 'react';
import "../index.css";
import "./ExperienceMotion.css";
import jsPDF from "jspdf";
import { apiRequest } from "../api";

function AnimatedMetric({ value }) {
  const [displayValue, setDisplayValue] = useState(value);
  const displayedValue = useRef(value);
  const shouldAnimate = typeof value === "number"
    && Number.isFinite(value)
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!shouldAnimate) {
      displayedValue.current = value;
      return undefined;
    }

    const from = Number(displayedValue.current);
    const to = value;
    if (from === to) return undefined;

    let frameId = 0;
    let startedAt = 0;
    const animate = (timestamp) => {
      if (!startedAt) startedAt = timestamp;
      const progress = Math.min(1, (timestamp - startedAt) / 520);
      const easedProgress = 1 - ((1 - progress) ** 3);
      const nextValue = Math.round(from + ((to - from) * easedProgress));
      displayedValue.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [value, shouldAnimate]);

  return <span className="motion-metric-value">{shouldAnimate ? displayValue : value}</span>;
}

function Home({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState("");
  const homeRef = useRef(null);

  const scrollToSection = (sectionId) => {
    setMenuOpen(false);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    document.getElementById(sectionId)?.scrollIntoView({
      behavior,
      block: "start",
    });
  };

  const navigateToSection = (event, sectionId) => {
    event.preventDefault();
    scrollToSection(sectionId);
  };

  // Keep the slim reading-progress indicator in sync without rerendering on every scroll.
  useEffect(() => {
    const home = homeRef.current;
    if (!home) return undefined;

    let frameId = 0;
    const updateProgress = () => {
      frameId = 0;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollableHeight > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollableHeight)) : 0;
      home.style.setProperty("--page-scroll-progress", String(progress));
    };
    const scheduleUpdate = () => {
      if (!frameId) frameId = window.requestAnimationFrame(updateProgress);
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  // Highlight the destination currently passing through the page's reading line.
  useEffect(() => {
    const sectionIds = ["forensics", "workflow", "tools", "erasure", "recovery"];
    const sections = sectionIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (!("IntersectionObserver" in window) || sections.length === 0) return undefined;

    const visibleSections = new Map();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visibleSections.set(entry.target.id, entry.target.getBoundingClientRect().top);
        else visibleSections.delete(entry.target.id);
      });

      const nearestSection = [...visibleSections.entries()]
        .sort((left, right) => Math.abs(left[1] - window.innerHeight * 0.4) - Math.abs(right[1] - window.innerHeight * 0.4))[0];
      if (nearestSection) setCurrentSection(nearestSection[0]);
    }, { threshold: 0, rootMargin: "-35% 0px -55% 0px" });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);


  // Erasure State
  const [erasureOpen, setErasureOpen] = useState(false);
  const [securityLevel, setSecurityLevel] = useState("Standard");
  const [erasureMethod, setErasureMethod] = useState("Quick Secure Erase");
  const [erasureProgress, setErasureProgress] = useState(0);
  const [isErasing, setIsErasing] = useState(false);
  const [erasureCompleted, setErasureCompleted] = useState(false);

  // Recovery State
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanCompleted, setScanCompleted] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [recoveringFile, setRecoveringFile] = useState("");
  const [recoveryProgress, setRecoveryProgress] = useState(0);
  const [isRecoveringAll, setIsRecoveringAll] = useState(false);
  const [recoverAllProgress, setRecoverAllProgress] = useState(0);
  const [allFilesRecovered, setAllFilesRecovered] = useState(false);
  const [recoveredFiles, setRecoveredFiles] = useState([]);
  const [recoverableFiles, setRecoverableFiles] = useState([]);
  const [selectedSource, setSelectedSource] = useState("Drive D: (Data)");
  const [selectedFileType, setSelectedFileType] = useState("All Files");
  const [operationError, setOperationError] = useState("");
  const [erasureMessage, setErasureMessage] = useState("");

  // Report State
  const [reportId, setReportId] = useState("FX-2026-001");
  const [caseId, setCaseId] = useState("");

  const openErasureDemo = () => {
    setOperationError("");
    setErasureMessage("");
    setErasureCompleted(false);
    setErasureProgress(0);
    setErasureOpen(true);
  };

  const openRecoveryDemo = () => {
    setOperationError("");
    setRecoveryOpen(true);
  };

  // Keep the cursor glow and hero parallax off React's render cycle.
  useEffect(() => {
    const home = homeRef.current;
    const hero = home?.querySelector(".cosmic-hero");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    if (!home || !hero || reduceMotion || coarsePointer) return undefined;

    let pointerPosition = null;
    let frameId = 0;

    const resetParallax = () => {
      home.style.setProperty("--hero-planet-x", "0px");
      home.style.setProperty("--hero-planet-y", "0px");
      home.style.setProperty("--hero-ring-one-x", "0px");
      home.style.setProperty("--hero-ring-one-y", "0px");
      home.style.setProperty("--hero-ring-two-x", "0px");
      home.style.setProperty("--hero-ring-two-y", "0px");
      home.style.setProperty("--mouse-x", "-500px");
      home.style.setProperty("--mouse-y", "-500px");
    };

    const updateParallax = () => {
      frameId = 0;
      if (!pointerPosition) return;

      const bounds = hero.getBoundingClientRect();
      const relativeX = Math.max(-1, Math.min(1, ((pointerPosition.x - bounds.left) / bounds.width - 0.5) * 2));
      const relativeY = Math.max(-1, Math.min(1, ((pointerPosition.y - bounds.top) / bounds.height - 0.5) * 2));

      home.style.setProperty("--mouse-x", `${pointerPosition.x}px`);
      home.style.setProperty("--mouse-y", `${pointerPosition.y}px`);
      home.style.setProperty("--hero-planet-x", `${relativeX * 9}px`);
      home.style.setProperty("--hero-planet-y", `${relativeY * 7}px`);
      home.style.setProperty("--hero-ring-one-x", `${relativeX * -7}px`);
      home.style.setProperty("--hero-ring-one-y", `${relativeY * -5}px`);
      home.style.setProperty("--hero-ring-two-x", `${relativeX * 5}px`);
      home.style.setProperty("--hero-ring-two-y", `${relativeY * 4}px`);
    };

    const handlePointerMove = (event) => {
      if (event.pointerType === "touch") return;
      pointerPosition = { x: event.clientX, y: event.clientY };
      if (!frameId) frameId = window.requestAnimationFrame(updateParallax);
    };

    const handlePointerLeave = () => {
      pointerPosition = null;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      resetParallax();
    };

    home.addEventListener("pointermove", handlePointerMove, { passive: true });
    home.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    return () => {
      home.removeEventListener("pointermove", handlePointerMove);
      home.removeEventListener("pointerleave", handlePointerLeave);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const revealItems = document.querySelectorAll(".scroll-reveal");
    if (!("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const recoverSingleFile = async (fileName) => {
    setRecoveringFile(fileName);
    setOperationError("");
    try {
      const result = await apiRequest("/api/recover", { caseId, fileName });
      setRecoveredFiles(result.files.filter((file) => file.recovered).map((file) => file.name));
      setAllFilesRecovered(result.files.length > 0 && result.files.every((file) => file.recovered));
      setRecoveryProgress(100);
    } catch (error) {
      setOperationError(error.message);
    } finally {
      setRecoveringFile("");
    }
  };

  const startRecoveryScan = async () => {
    setOperationError("");
    setScanCompleted(false);
    setIsScanning(true);
    setScanProgress(15);
    try {
      const result = await apiRequest("/api/scan", {
        caseId: caseId || undefined,
        source: selectedSource,
        fileType: selectedFileType,
      });
      setCaseId(result.caseId);
      setReportId(result.reportId);
      setRecoverableFiles(result.files || []);
      setRecoveredFiles((result.files || []).filter((file) => file.recovered).map((file) => file.name));
      setAllFilesRecovered((result.files || []).length > 0 && result.files.every((file) => file.recovered));
      setScanProgress(100);
      setScanCompleted(true);
    } catch (error) {
      setOperationError(error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const recoverAllFiles = async () => {
    setOperationError("");
    setIsRecoveringAll(true);
    setRecoverAllProgress(15);
    try {
      const result = await apiRequest("/api/recover-all", { caseId });
      setRecoverableFiles(result.files || []);
      setRecoveredFiles((result.files || []).filter((file) => file.recovered).map((file) => file.name));
      setAllFilesRecovered(true);
      setRecoverAllProgress(100);
    } catch (error) {
      setOperationError(error.message);
    } finally {
      setIsRecoveringAll(false);
    }
  };

  const simulateErasure = async () => {
    setOperationError("");
    setErasureMessage("");
    setIsErasing(true);
    setErasureProgress(15);
    try {
      const result = await apiRequest("/api/erase", {
        securityLevel,
        method: erasureMethod,
        source: selectedSource,
      });
      setErasureProgress(100);
      setErasureCompleted(Boolean(result.simulated));
      setErasureMessage(result.message);
    } catch (error) {
      setOperationError(error.message);
    } finally {
      setIsErasing(false);
    }
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    const totalFiles = recoverableFiles.length;
    const recovered = recoveredFiles.length;
    const files = recoverableFiles.map((file) => file.name);
    const currentDate = new Date();
    const date = currentDate.toLocaleDateString();
    const time = currentDate.toLocaleTimeString();

    // HEADER
    doc.setFillColor(10, 18, 40);
    doc.rect(0, 0, 210, 42, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("ForensiX", 20, 20);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Digital Forensics Platform", 20, 29);

    doc.setFontSize(10);
    doc.text("FORENSIC REPORT", 145, 20);

    // REPORT INFORMATION
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Forensic Investigation Report", 20, 58);

    doc.setDrawColor(80, 100, 150);
    doc.line(20, 64, 190, 64);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Case ID: ${caseId || "Not created"}`, 20, 68);
    doc.text(`Report ID: ${reportId}`, 20, 78);
    doc.text(`Generated Date: ${date}`, 20, 88);
    doc.text(`Generated Time: ${time}`, 20, 98);

    // INVESTIGATION DETAILS
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Investigation Details", 20, 116);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Investigation Type: File Recovery", 25, 128);
    doc.text(`Total Files Found: ${totalFiles}`, 25, 138);
    doc.text(`Recovered Files: ${recovered}`, 25, 148);
    doc.text("Investigation Status: Prototype snapshot", 25, 158);

    // SECURITY STATUS
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Security Status", 20, 178);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("DEMO  Workflow uses sample data", 25, 190);
    doc.text(`DEMO  Recovery status: ${recovered} of ${totalFiles} files`, 25, 200);
    doc.text("DEMO  No storage device was accessed", 25, 210);

    // EVIDENCE SUMMARY
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Evidence Summary", 20, 230);

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    doc.text("This report uses sample data only. No storage device", 25, 242);
    doc.text("was accessed and no real files were recovered or erased.", 25, 250);

    // RECOVERED FILES
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Recovered Files", 20, 266);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");

    let y = 276;

    files.forEach((file, index) => {
      const isRecovered = allFilesRecovered || recoveredFiles.includes(file);
      doc.text(`${index + 1}. ${file}`, 25, y);
      doc.text(isRecovered ? "RECOVERED" : "NOT RECOVERED", 125, y);
      y += 7;
    });

    // SUMMARY PAGE
    doc.addPage();
    doc.setFillColor(10, 18, 40);
    doc.rect(0, 0, 210, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("ForensiX Investigation Summary", 20, 20);

    doc.setTextColor(30, 30, 30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Case Summary", 20, 52);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Report ID: ${reportId}`, 25, 65);
    doc.text(`Files Found: ${totalFiles}`, 25, 75);
    doc.text(`Files Recovered: ${recovered}`, 25, 85);
    doc.text("Status: Prototype snapshot", 25, 95);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Investigation Note", 20, 120);

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    const note =
      "This report uses sample data and is not a record of real forensic operations.";
    const wrappedNote = doc.splitTextToSize(note, 165);
    doc.text(wrappedNote, 25, 132);

    // FOOTER
    doc.setDrawColor(180, 180, 180);
    doc.line(20, 270, 190, 270);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text("Generated by ForensiX Digital Forensics Platform", 20, 280);
    doc.text("This document is generated electronically.", 20, 288);

    doc.save(`${reportId}-Forensic-Report.pdf`);
  };

  return (
    <main id="home" className="home" ref={homeRef}>
      <div className="home-scroll-progress" aria-hidden="true" />
      <div className="blob blob-one"></div>
      <div className="blob blob-two"></div>

      {/* NAVBAR */}
      <nav className="navbar glass">
        <div className="logo">
          <div className="logo-icon">🛡</div>
          <span>ForensiX</span>
        </div>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "✕" : "☰"}
        </button>

        <div className={`nav-links ${menuOpen ? "active" : ""}`}>
          <a href="#forensics" className={currentSection === "forensics" ? "is-current" : ""} aria-current={currentSection === "forensics" ? "location" : undefined} onClick={(event) => navigateToSection(event, "forensics")}>Features</a>
          <a href="#workflow" className={currentSection === "workflow" ? "is-current" : ""} aria-current={currentSection === "workflow" ? "location" : undefined} onClick={(event) => navigateToSection(event, "workflow")}>How It Works</a>
          <a href="#tools" className={currentSection === "tools" ? "is-current" : ""} aria-current={currentSection === "tools" ? "location" : undefined} onClick={(event) => navigateToSection(event, "tools")}>Tools</a>
          <a href="#erasure" className={currentSection === "erasure" ? "is-current" : ""} aria-current={currentSection === "erasure" ? "location" : undefined} onClick={(event) => navigateToSection(event, "erasure")}>Security</a>
          <a href="#forensics" className={currentSection === "forensics" ? "is-current" : ""} aria-current={currentSection === "forensics" ? "location" : undefined} onClick={(event) => navigateToSection(event, "forensics")}>Forensics</a>
          <a href="#recovery" className={`nav-button ${currentSection === "recovery" ? "is-current" : ""}`} aria-current={currentSection === "recovery" ? "location" : undefined} onClick={(event) => navigateToSection(event, "recovery")}>
            Get Started →
          </a>
          <button className="nav-logout" type="button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="hero cosmic-hero">
        <div className="cosmic-art" aria-hidden="true">
          <div className="cosmic-planet"></div>
          <div className="cosmic-ring cosmic-ring-one"></div>
          <div className="cosmic-ring cosmic-ring-two"></div>
          <span className="cosmic-rock rock-one"></span>
          <span className="cosmic-rock rock-two"></span>
          <span className="cosmic-rock rock-three"></span>
          <span className="cosmic-rock rock-four"></span>
        </div>

        <div className="hero-content cosmic-hero-content">
          <div className="badge">
            <span className="status-dot"></span>
            DIGITAL FORENSICS · DEMO WORKSPACE
          </div>

          <h1 className="hero-brand-title">FORENSIX</h1>
          <p className="hero-tagline">PRESERVE THE EVIDENCE. TRACE EVERY ACTION.</p>
          <p className="hero-description">
            Explore sample recovery, erasure simulations and forensic reporting
            in one focused workspace.
          </p>

          <div className="hero-buttons">
            <button
              className="primary-button"
              onClick={() => scrollToSection("forensics")}
            >
              Explore the platform <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
      </section>

      {/* CINEMATIC EVIDENCE MOTION */}
      <section className="forensic-motion-section scroll-reveal" aria-labelledby="motion-heading">
        <div className="forensic-motion-copy">
          <span className="section-tag">EVIDENCE IN MOTION · DEMO</span>
          <h2 id="motion-heading">
            Follow the signal.
            <br />
            <span>Keep every detail.</span>
          </h2>
          <p>
            A cinematic preview of the investigation flow: map evidence, inspect each item,
            then follow its recovery and reporting trail.
          </p>
          <div className="motion-proof-list">
            <div><span>01</span><p>Evidence map</p><b>TRACE</b></div>
            <div><span>02</span><p>Artifact review</p><b>INSPECT</b></div>
            <div><span>03</span><p>Recovery history</p><b>RECORD</b></div>
          </div>
        </div>

        <div className="forensic-motion-window" aria-hidden="true">
          <div className="motion-window-topbar">
            <div className="motion-window-brand"><span>F</span> FORENSIX</div>
            <div className="motion-window-nav"><span>Overview</span><span>Evidence</span><span>Activity</span></div>
            <span className="motion-live"><i></i> DEMO LIVE</span>
          </div>

          <div className="motion-viewport" aria-hidden="true">
            <div className="motion-camera">
              <div className="motion-grid"></div>
              <div className="motion-scene motion-scene-one">
                <div className="motion-scene-copy">
                  <span className="motion-kicker">GLOBAL EVIDENCE NETWORK</span>
                  <h3>Every clue.<br />In its right place.</h3>
                  <p>Connect the signal. Follow the trail.</p>
                </div>
                <div className="motion-globe">
                  <div className="motion-globe-surface"></div>
                  <div className="motion-globe-latitude"></div>
                  <div className="motion-globe-longitude"></div>
                  <svg className="motion-route" viewBox="0 0 420 260" fill="none">
                    <path d="M35 190C88 42 147 233 213 121S326 30 385 84" />
                    <path d="M43 74C113 193 172 33 245 144S337 223 386 174" />
                  </svg>
                  <i className="motion-node motion-node-one"></i>
                  <i className="motion-node motion-node-two"></i>
                  <i className="motion-node motion-node-three"></i>
                </div>
                <div className="motion-float-card motion-signal-card">
                  <span>CASE SIGNAL</span><strong>Evidence linked</strong><small><i></i> 3 sample artifacts</small>
                </div>
                <div className="motion-float-card motion-integrity-card">
                  <span>INTEGRITY CHECK</span><strong>SHA-256</strong><small>Sample verification · 100%</small>
                </div>
              </div>

              <div className="motion-scene motion-scene-two">
                <div className="motion-scene-copy">
                  <span className="motion-kicker">ARTIFACT REVIEW</span>
                  <h3>Follow each<br />piece of evidence.</h3>
                  <p>Clear status, source and activity in one view.</p>
                </div>
                <div className="motion-review-panel">
                  <div className="motion-panel-heading"><span>RECENT EVIDENCE</span><b>3 ITEMS</b></div>
                  <div className="motion-review-row"><i className="motion-file-icon">PDF</i><span><strong>project_report.pdf</strong><small>Drive D: · Sample file</small></span><b>VERIFIED</b></div>
                  <div className="motion-review-row"><i className="motion-file-icon image">IMG</i><span><strong>vacation_photo.jpg</strong><small>Drive D: · Sample file</small></span><b>VERIFIED</b></div>
                  <div className="motion-review-row"><i className="motion-file-icon video">VID</i><span><strong>family_video.mp4</strong><small>Drive D: · Sample file</small></span><b>READY</b></div>
                </div>
                <div className="motion-review-glow"></div>
              </div>

              <div className="motion-scene motion-scene-three">
                <div className="motion-scene-copy">
                  <span className="motion-kicker">AUDITABLE WORKFLOW</span>
                  <h3>From first scan<br />to final report.</h3>
                  <p>See each step and keep the case history together.</p>
                </div>
                <div className="motion-timeline-panel">
                  <div className="motion-panel-heading"><span>CASE ACTIVITY</span><b>DEMO CASE</b></div>
                  <div className="motion-timeline-line"><i></i><i></i><i></i></div>
                  <div className="motion-timeline-items">
                    <div><span>01</span><strong>Scan</strong><small>Evidence listed</small></div>
                    <div><span>02</span><strong>Review</strong><small>Items inspected</small></div>
                    <div><span>03</span><strong>Report</strong><small>History ready</small></div>
                  </div>
                  <div className="motion-complete-bar"><span></span></div>
                  <small className="motion-complete-label">SAMPLE WORKFLOW · COMPLETE</small>
                </div>
              </div>
            </div>
          </div>

          <div className="motion-window-footer">
            <span><i></i> SAMPLE DATA · NO DEVICE ACCESS</span>
            <div className="motion-progress"><i></i></div>
            <span>01 — 03</span>
          </div>
        </div>
      </section>

      {/* FORENSICS SECTION */}
      <section className="forensics-section scroll-reveal" id="forensics">
        <div className="forensics-content">
          <div className="forensics-info">
            <span className="section-tag">DIGITAL FORENSICS</span>
            <h2>
              Analyze evidence.
              <br />
              <span>Discover the details.</span>
            </h2>

            <p>
              Explore sample evidence, review the investigation workflow and generate
              a report marked for prototype use.
            </p>

            <div className="forensics-points">
              <div className="point">
                <span>✓</span>
                <p>Sample evidence and file inspection</p>
              </div>
              <div className="point">
                <span>✓</span>
                <p>Sample report generation</p>
              </div>
              <div className="point">
                <span>✓</span>
                <p>Detailed forensic report generation</p>
              </div>
            </div>

            <button className="primary-button" onClick={downloadReport}>
              Download Demo Report →
            </button>
          </div>

          <div className="forensics-dashboard glass">
            <div className="forensics-top">
              <div>
                <p>FORENSIC ANALYSIS</p>
                <h3>Investigation Console</h3>
              </div>
              <span className="forensic-status">● DEMO</span>
            </div>

            <div className="evidence-stats">
              <div>
                <span>Evidence Files</span>
                <strong><AnimatedMetric value={recoverableFiles.length} /></strong>
              </div>
              <div>
                <span>Analyzed</span>
                <strong><AnimatedMetric value={recoveredFiles.length} /></strong>
              </div>
              <div>
                <span>Alerts</span>
                <strong>00</strong>
              </div>
            </div>

            <div className="evidence-list">
              <div className="evidence-item">
                <span className="evidence-icon">📄</span>
                <div>
                  <strong>project_report.pdf</strong>
                  <span>Sample file • 95%</span>
                </div>
                <b>✓</b>
              </div>

              <div className="evidence-item">
                <span className="evidence-icon">🖼️</span>
                <div>
                  <strong>vacation_photo.jpg</strong>
                  <span>Sample file • 98%</span>
                </div>
                <b>✓</b>
              </div>

              <div className="evidence-item">
                <span className="evidence-icon">📦</span>
                <div>
                  <strong>family_video.mp4</strong>
                  <span>Sample file • 91%</span>
                </div>
                <b>•••</b>
              </div>
            </div>
          </div>
        </div>

        <div className="case-summary scroll-reveal">
          <div className="case-header">
            <span>CASE SUMMARY</span>
            <strong>{reportId}</strong>
          </div>

          <div className="case-grid">
            <div className="case-item">
              <span>Case ID</span>
              <strong>{caseId || "Not created"}</strong>
            </div>
            <div className="case-item">
              <span>Evidence Files</span>
              <strong>{recoverableFiles.length}</strong>
            </div>
            <div className="case-item">
              <span>Recovered</span>
              <strong>{recoveredFiles.length}</strong>
            </div>
            <div className="case-item">
              <span>Status</span>
              <strong className="case-secure">{caseId ? "Scan complete" : "Not scanned"}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* ERASURE SECTION */}
      <section className="erasure-section scroll-reveal" id="erasure">
        <div className="erasure-content">
          <div className="erasure-info">
            <span className="section-tag">ERASURE SIMULATION</span>
            <h2>
              Preview erasure.
              <br />
              <span>Choose a method.</span>
            </h2>

            <p>
              Review sanitization options in a simulation. This prototype does not
              access drives or delete files.
            </p>

            <div className="erasure-points">
              <div className="point">
                <span>✓</span>
                <p>Explore data sanitization choices</p>
              </div>
              <div className="point">
                <span>✓</span>
                <p>Compare security levels</p>
              </div>
              <div className="point">
                <span>✓</span>
                <p>Confirm a no-op demo result</p>
              </div>
            </div>

            <button className="primary-button" onClick={openErasureDemo}>
              Configure Erasure Demo →
            </button>
          </div>

          <div className="erasure-dashboard glass">
            <div className="dashboard-top">
              <div>
                <p>SECURE ERASURE</p>
                <h3>Sanitization Process</h3>
              </div>
              <span className="active-status">● SIMULATION</span>
            </div>

            <div className="drive-card">
              <div className="drive-icon">💾</div>
              <div>
                <p>Selected Storage</p>
                <h4>{selectedSource}</h4>
              </div>
              <span>DEMO</span>
            </div>

            <div className="progress-area">
              <div className="progress-text">
                <span>Erasure Progress</span>
                <strong>{erasureCompleted ? "100%" : "0%"}</strong>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${erasureCompleted ? 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="dashboard-stats">
              <div>
                <p>Files Processed</p>
                <h4>0</h4>
              </div>
              <div>
                <p>Time Remaining</p>
                <h4>—</h4>
              </div>
              <div>
                <p>Security Level</p>
                <h4>{securityLevel}</h4>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RECOVERY SECTION */}
      <section className="recovery-section scroll-reveal" id="recovery">
        <div className="recovery-content">
          <div className="recovery-dashboard glass">
            <div className="recovery-top">
              <div>
                <p>FILE RECOVERY</p>
                <h3>Sample Storage Preview</h3>
              </div>
              <span className="scan-status">● SAMPLE DATA</span>
            </div>

            <div className="scan-circle">
              <div className="scan-inner">
                <strong>{scanCompleted ? "100%" : "—"}</strong>
                <span>{scanCompleted ? "Scan complete" : "Preview"}</span>
              </div>
            </div>

            <div className="recovery-progress">
              <div>
                <span>Sample Files</span>
                <strong><AnimatedMetric value={recoverableFiles.length || 3} /></strong>
              </div>
              <div>
                <span>Recoverable</span>
                <strong><AnimatedMetric value={recoverableFiles.length} /></strong>
              </div>
            </div>

            <div className="found-files">
              <div className="file-item">
                <span className="file-icon">📄</span>
                <div>
                  <p>project_report.pdf</p>
                  <span>2.4 MB</span>
                </div>
                <strong>95%</strong>
              </div>

              <div className="file-item">
                <span className="file-icon">🖼️</span>
                <div>
                  <p>vacation_photo.jpg</p>
                  <span>4.8 MB</span>
                </div>
                <strong>98%</strong>
              </div>
            </div>
          </div>

          <div className="recovery-info">
            <span className="section-tag">FILE RECOVERY DEMO</span>
            <h2>
              Lost your files?
              <br />
              <span>Recover them safely.</span>
            </h2>

            <p>
              Review a fixed sample file list and simulate recovery state changes.
              The prototype does not scan storage devices.
            </p>

            <div className="recovery-points">
              <div className="point">
                <span>✓</span>
                <p>Choose a sample storage location</p>
              </div>
              <div className="point">
                <span>✓</span>
                <p>Review a fixed sample file list</p>
              </div>
              <div className="point">
                <span>✓</span>
                <p>File recovery confidence score</p>
              </div>
            </div>

            <button
              className="primary-button"
              onClick={openRecoveryDemo}
            >
              Open Recovery Demo →
            </button>
          </div>
        </div>
      </section>

      {/* WORKFLOW SECTION */}
      <section className="workflow-section scroll-reveal" id="workflow">
        <div className="workflow-header">
          <span className="section-tag">HOW IT WORKS</span>
          <h2>
            Simple process.
            <br />
            <span>Powerful technology.</span>
          </h2>
          <p>
            Follow the sample scan, recovery and erasure simulation in a few steps.
          </p>
        </div>

        <div className="workflow-steps">
          <div className="workflow-card glass scroll-reveal">
            <div className="step-number">01</div>
            <div className="workflow-icon">💾</div>
            <h3>Select Sample Storage</h3>
            <p>Choose a sample location for the demo workflow.</p>
          </div>

          <div className="workflow-card glass scroll-reveal">
            <div className="step-number">02</div>
            <div className="workflow-icon">🔍</div>
            <h3>Review Sample Data</h3>
            <p>Inspect fixed sample files returned by the demo API.</p>
          </div>

          <div className="workflow-card glass scroll-reveal">
            <div className="step-number">03</div>
            <div className="workflow-icon">📊</div>
            <h3>Preview Results</h3>
            <p>Simulate recovery state changes and download a prototype report.</p>
          </div>
        </div>
      </section>

      {/* TOOLS SECTION */}
      <section className="tools-section scroll-reveal" id="tools">
        <div className="tools-header">
          <span className="section-tag">ADVANCED TOOLS</span>
          <h2>
            Everything you need.
            <br />
            <span>One powerful platform.</span>
          </h2>
          <p>
            Preview sample data management and digital-forensics workflows.
          </p>
        </div>

        <div className="tools-grid">
          <button type="button" className="tool-card glass scroll-reveal" onClick={openErasureDemo}>
            <div className="tool-icon">🛡️</div>
            <h3>Erasure Simulation</h3>
            <p>Compare options without accessing a drive or deleting files.</p>
            <span className="tool-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" className="tool-card glass scroll-reveal" onClick={openRecoveryDemo}>
            <div className="tool-icon">🔄</div>
            <h3>Recovery Demo</h3>
            <p>Update recovery status for fixed sample files.</p>
            <span className="tool-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" className="tool-card glass scroll-reveal" onClick={() => scrollToSection("forensics")}>
            <div className="tool-icon">🔍</div>
            <h3>Sample Investigation</h3>
            <p>Review a small sample evidence set and case summary.</p>
            <span className="tool-arrow" aria-hidden="true">→</span>
          </button>

          <button type="button" className="tool-card glass scroll-reveal" onClick={downloadReport}>
            <div className="tool-icon">📊</div>
            <h3>Prototype Reports</h3>
            <p>Download a report that clearly identifies its sample data.</p>
            <span className="tool-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="cta-section scroll-reveal">
        <div className="cta-box glass">
          <span className="section-tag">READY TO START?</span>
          <h2>
            Explore the demo.
            <br />
            <span>Preview the workflow.</span>
          </h2>
          <p>
            Try a sample scan, recovery actions, an erasure simulation and a prototype report.
          </p>
          <button className="primary-button" onClick={openRecoveryDemo}>Get Started →</button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer scroll-reveal">
        <div className="footer-content">
          <div className="footer-brand">
            <h2>FOREN<span>SIX</span></h2>
            <p>
              A prototype for sample file recovery and digital-forensics workflows.
            </p>
          </div>

          <div className="footer-links">
            <div>
              <h4>Platform</h4>
              <a href="#erasure" onClick={(event) => navigateToSection(event, "erasure")}>Data Erasure</a>
              <a href="#recovery" onClick={(event) => navigateToSection(event, "recovery")}>File Recovery</a>
              <a href="#forensics" onClick={(event) => navigateToSection(event, "forensics")}>Forensics</a>
            </div>

            <div>
              <h4>Company</h4>
              <a href="#workflow" onClick={(event) => navigateToSection(event, "workflow")}>How It Works</a>
              <a href="#tools" onClick={(event) => navigateToSection(event, "tools")}>Tools</a>
              <a href="#home" onClick={(event) => navigateToSection(event, "home")}>Home</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© 2026 FORENSIX. All rights reserved.</p>
          <p>Built for Smart India Hackathon 🚀</p>
        </div>
      </footer>

      {/* MODAL: SECURE ERASURE */}
      {erasureOpen && (
        <div className="modal-overlay">
          <div className="erasure-modal glass">
            <div className="modal-header">
              <div>
                <span className="section-tag">SECURE TOOL</span>
                <h2>🛡 Erasure Simulation</h2>
              </div>
              <button className="close-modal" onClick={() => setErasureOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label>Select Drive</label>
                <select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)}>
                  <option value="Drive C: (System)">Drive C: (System)</option>
                  <option value="Drive D: (Data)">Drive D: (Data)</option>
                  <option value="External USB Drive">External USB Drive</option>
                </select>
              </div>

              <div className="form-group">
                <label>Erasure Method</label>
                <select value={erasureMethod} onChange={(event) => setErasureMethod(event.target.value)}>
                  <option value="Quick Secure Erase">Quick Secure Erase</option>
                  <option value="DoD 5220.22-M">DoD 5220.22-M</option>
                  <option value="Advanced Multi-Pass Erasure">Advanced Multi-Pass Erasure</option>
                </select>
              </div>

              <div className="form-group">
                <label>Security Level</label>
                <div className="security-level">
                  {["Standard", "High", "Maximum"].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`security-option ${securityLevel === level ? "active" : ""}`}
                      onClick={() => setSecurityLevel(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <p className="operation-note">Demo only: no drive is accessed and no data is deleted.</p>
              {operationError && <p className="operation-error" role="alert">{operationError}</p>}

              <button
                className="start-erasure-button"
                disabled={isErasing}
                onClick={simulateErasure}
              >
                {isErasing ? `Running simulation... ${erasureProgress}%` : "Run Erasure Simulation"}
              </button>

              {isErasing && (
                <div className="progress-container">
                  <div className="progress-bar" style={{ width: `${erasureProgress}%` }}></div>
                </div>
              )}

              {erasureCompleted && (
                <div className="success-message">
                  <div className="success-icon">✓</div>
                  <div>
                    <h3>Simulation completed</h3>
                    <p>{erasureMessage || "No data was deleted."}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FILE RECOVERY */}
      {recoveryOpen && (
        <div className="modal-overlay">
          <div className="recovery-modal glass">
            <div className="modal-header">
              <div>
                <span className="section-tag">RECOVERY TOOL</span>
                <h2>🔎 File Recovery</h2>
              </div>
              <button className="close-modal" onClick={() => setRecoveryOpen(false)}>
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="form-group">
                <label>Select Location</label>
                <select value={selectedSource} onChange={(event) => setSelectedSource(event.target.value)}>
                  <option value="Drive C: (System)">Drive C: (System)</option>
                  <option value="Drive D: (Data)">Drive D: (Data)</option>
                  <option value="External USB Drive">External USB Drive</option>
                </select>
              </div>

              <div className="form-group">
                <label>File Type</label>
                <select value={selectedFileType} onChange={(event) => setSelectedFileType(event.target.value)}>
                  <option value="All Files">All Files</option>
                  <option value="Images">Images</option>
                  <option value="Documents">Documents</option>
                  <option value="Videos">Videos</option>
                  <option value="Audio Files">Audio Files</option>
                </select>
              </div>

              <button
                className="start-erasure-button"
                disabled={isScanning}
                onClick={startRecoveryScan}
              >
                {isScanning ? "🔍 Scanning sample files..." : "🔎 Start Demo Scan"}
              </button>

              {operationError && !scanCompleted && <p className="operation-error" role="alert">{operationError}</p>}

              {isScanning && (
                <div className="scan-loading">
                  <div className="scan-status">
                    <div>
                      <h3>Scanning Files...</h3>
                      <p>Searching for recoverable files...</p>
                    </div>
                    <span className="scan-percentage">{scanProgress}%</span>
                  </div>
                  <div className="scan-progress-container">
                    <div className="scan-progress-bar" style={{ width: `${scanProgress}%` }}></div>
                  </div>
                </div>
              )}

           {scanCompleted && (
  <div className="recovery-results">
    <div className="results-header">
      <div>
        <span className="results-badge">✓ SCAN COMPLETE</span>
        <h3>Recoverable Files Found</h3>
        <p>We found files that may be recovered.</p>
      </div>
      <div className="files-count">
        {recoverableFiles.length} <span>Files</span>
      </div>
    </div>

    {/* SINGLE FILE PROGRESS ANIMATION */}
    {recoveringFile && (
      <div className="item-progress-box">
        <div className="item-progress-info">
          <span>Recovering: <strong>{recoveringFile}</strong></span>
          <span>{recoveryProgress}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill animated-bar"
            style={{ width: `${recoveryProgress}%` }}
          ></div>
        </div>
      </div>
    )}

    {/* BULK RECOVERY PROGRESS ANIMATION */}
    {isRecoveringAll && (
      <div className="item-progress-box">
        <div className="item-progress-info">
          <span>Recovering All Files...</span>
          <span>{recoverAllProgress}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill animated-bar"
            style={{ width: `${recoverAllProgress}%` }}
          ></div>
        </div>
      </div>
    )}

    <div className="file-actions">
      <button
        className="recover-all-button"
        disabled={isRecoveringAll || Boolean(recoveringFile) || !caseId || recoverableFiles.length === 0}
        onClick={recoverAllFiles}
      >
        {isRecoveringAll ? "Recovering sample files..." : "Recover All"}
      </button>

      <button
        className="report-button"
        onClick={downloadReport}
      >
        📄 Download Forensic Report PDF
      </button>
    </div>

    {recoverableFiles.length === 0 && (
      <p className="operation-note">No sample files matched this file type.</p>
    )}

    {/* FILE LIST */}
    <div className="file-list">
      {recoverableFiles.map((file) => {
        const isThisRecovering = recoveringFile === file.name;
        const isRecovered = file.recovered || allFilesRecovered || recoveredFiles.includes(file.name);
        const icon = file.type === "image" ? "🖼️" : file.type === "video" ? "🎬" : "📄";

        return (
          <div key={file.name} className="file-list-item">
            <div className="file-info">
              <span>{icon}</span>
              <span>{file.name}</span>
            </div>

            <button
              className={`recover-item-btn ${isRecovered ? "success" : ""}`}
              disabled={Boolean(recoveringFile) || isRecoveringAll || isRecovered}
              onClick={() => recoverSingleFile(file.name)}
            >
              {isThisRecovering
                ? `${recoveryProgress}%`
                : isRecovered
                ? "Recovered ✓"
                : "Recover"}
            </button>
          </div>
        );
      })}
    </div>
    {operationError && <p className="operation-error" role="alert">{operationError}</p>}
  </div>
)}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Home;
