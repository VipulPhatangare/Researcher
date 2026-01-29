import PDFDocument from 'pdfkit';
import ResearchSession from '../models/ResearchSession.model.js';

/**
 * Generate comprehensive PDF report for research session (Phases 1-6)
 * Includes: Cover, TOC, Executive Summary, All 6 Phases, Gap Analysis, Literature Review
 */
export const generatePDFReport = async (req, res) => {
  try {
    const { chatId } = req.params;

    // Fetch session data
    const session = await ResearchSession.findOne({ chatId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Research session not found'
      });
    }

    // Check if Phase 6 is completed
    if (session.phases.phase6.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Phase 6 must be completed before generating report'
      });
    }

    // Create PDF document
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      bufferPages: true
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Research_Report_${chatId.slice(0, 8)}.pdf`);

    // Pipe PDF to response
    doc.pipe(res);

    // Store TOC entries for later generation
    const tocEntries = [];

    // ========== COVER PAGE ==========
    addCoverPage(doc, session, chatId);

    // ========== TABLE OF CONTENTS ==========
    doc.addPage();
    const tocPage = doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1;
    
    // ========== EXECUTIVE SUMMARY ==========
    doc.addPage();
    tocEntries.push({ title: 'Executive Summary', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addExecutiveSummary(doc, session);

    // ========== STATISTICS DASHBOARD ==========
    doc.addPage();
    tocEntries.push({ title: 'Research Statistics', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addStatisticsDashboard(doc, session);

    // ========== PHASE 1: PROMPT ENHANCEMENT ==========
    doc.addPage();
    tocEntries.push({ title: 'Phase 1: Prompt Enhancement', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addPhase1(doc, session);

    // ========== PHASE 2: RESEARCH DISCOVERY ==========
    if (doc.y > 650) doc.addPage();
    tocEntries.push({ title: 'Phase 2: Research Discovery', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addPhase2(doc, session);

    // ========== PHASE 3: ANALYSIS & SYNTHESIS ==========
    if (doc.y > 650) doc.addPage();
    tocEntries.push({ title: 'Phase 3: Deep Analysis', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addPhase3(doc, session);
    
    // ========== PHASE 4: GAP ANALYSIS ==========
    if (doc.y > 650) doc.addPage();
    tocEntries.push({ title: 'Phase 4: Gap Analysis', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addPhase4GapAnalysis(doc, session);

    // ========== PHASE 5: LITERATURE REVIEW ==========
    if (doc.y > 650) doc.addPage();
    tocEntries.push({ title: 'Phase 5: Literature Review', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addPhase5LiteratureReview(doc, session);

    // ========== PHASE 6: BEST SOLUTION ==========
    if (doc.y > 650) doc.addPage();
    tocEntries.push({ title: 'Phase 6: Best Solution', page: doc.bufferedPageRange().start + doc.bufferedPageRange().count - 1 });
    addPhase6(doc, session);
    // ========== GENERATE TABLE OF CONTENTS ==========
    generateTableOfContents(doc, tocPage, tocEntries);

    // ========== ADD PAGE NUMBERS ==========
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      // Skip page numbers on cover page
      if (i > 0) {
        doc.fontSize(8).fillColor('#718096')
           .text(`Page ${i + 1} of ${pages.count}`, 
             50, doc.page.height - 50, 
             { align: 'center' });
      }
    }

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('❌ PDF generation error:', error);
    
    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
        details: error.message
      });
    }
  }
};

// ========== HELPER FUNCTIONS ==========

/**
 * Add cover page
 */
function addCoverPage(doc, session, chatId) {
  doc.fontSize(28).font('Helvetica-Bold').fillColor('#1a365d')
     .text('Research Analysis Report', { align: 'center' });
  
  doc.moveDown();
  doc.fontSize(12).font('Helvetica').fillColor('#4a5568')
     .text(`Session ID: ${chatId.slice(0, 8)}`, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  
  doc.moveDown(3);
  doc.fontSize(14).fillColor('#2d3748')
     .text('Problem Statement:', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#000000')
     .text(session.originalInput, { align: 'justify' });
  
  doc.moveDown(3);
  
  // Add colored box with research info
  const boxY = doc.y;
  doc.rect(50, boxY, 495, 180).fillAndStroke('#f7fafc', '#4299e1');
  
  doc.fillColor('#2d3748').fontSize(12).font('Helvetica-Bold')
     .text('Research Overview', 60, boxY + 15);
  
  doc.fontSize(10).font('Helvetica').fillColor('#4a5568');
  doc.text(`Started: ${new Date(session.createdAt).toLocaleString()}`, 60, boxY + 40);
  doc.text(`Status: ${session.overallStatus.toUpperCase()}`, 60, boxY + 60);
  doc.text(`Total Phases Completed: 6`, 60, boxY + 80);
  
  // Statistics preview
  const paperCount = session.papers?.length || 0;
  const githubCount = session.githubProjects?.length || 0;
  const appCount = session.applications?.length || 0;
  
  doc.text(`Research Papers Analyzed: ${paperCount}`, 60, boxY + 105);
  doc.text(`GitHub Projects Reviewed: ${githubCount}`, 60, boxY + 125);
  doc.text(`Applications Studied: ${appCount}`, 60, boxY + 145);
  
  doc.moveDown(12);
  doc.fontSize(10).fillColor('#718096').font('Helvetica-Oblique').text(
    'This comprehensive report includes prompt enhancement, research discovery, deep analysis, ' +
    'gap identification, literature review, and best solution recommendations.',
    { align: 'center', width: 495 }
  );
}

/**
 * Generate Table of Contents
 */
function generateTableOfContents(doc, tocPage, tocEntries) {
  doc.switchToPage(tocPage);
  
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a365d')
     .text('Table of Contents', { align: 'center' });
  
  doc.moveDown(2);
  
  tocEntries.forEach((entry, index) => {
    const isPhase = entry.title.startsWith('Phase');
    
    if (isPhase) {
      doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold');
    } else {
      doc.fontSize(11).fillColor('#4a5568').font('Helvetica');
    }
    
    const yPos = doc.y;
    doc.text(entry.title, 50, yPos, { continued: false, width: 400 });
    doc.text(`${entry.page}`, 450, yPos, { align: 'right', width: 95 });
    
    doc.moveDown(isPhase ? 0.8 : 0.5);
    
    // Add separator line for phases
    if (isPhase && index < tocEntries.length - 1) {
      doc.strokeColor('#e2e8f0').lineWidth(0.5)
         .moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);
    }
  });
}

/**
 * Add Executive Summary
 */
function addExecutiveSummary(doc, session) {
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a365d')
     .text('Executive Summary', { underline: true });
  doc.moveDown();
  
  doc.fontSize(10).fillColor('#000000').font('Helvetica');
  
  doc.text('This research report provides a comprehensive analysis of:', { underline: false });
  doc.moveDown(0.5);
  
  doc.fontSize(11).fillColor('#2d3748').font('Helvetica-Bold')
     .text('Original Problem:', { continued: false });
  doc.fontSize(10).fillColor('#000000').font('Helvetica')
     .text(session.originalInput, 
           { align: 'justify' });
  doc.moveDown();
  
  if (session.refinedProblem) {
    doc.fontSize(11).fillColor('#2d3748').font('Helvetica-Bold')
       .text('Refined Problem:', { continued: false });
    doc.fontSize(10).fillColor('#000000').font('Helvetica')
       .text(session.refinedProblem, 
             { align: 'justify' });
    doc.moveDown();
  }
  
  doc.fontSize(11).fillColor('#2d3748').font('Helvetica-Bold').text('Key Findings:', { underline: true });
  doc.moveDown(0.5);
  
  const findings = [
    `Analyzed ${session.papers?.length || 0} academic research papers for methodologies and insights`,
    `Reviewed ${session.githubProjects?.length || 0} open-source GitHub projects for practical implementations`,
    `Studied ${session.applications?.length || 0} existing applications for feature analysis`,
    'Identified research gaps and opportunities for innovation',
    'Generated comprehensive literature review with academic trends',
    'Developed best solution with implementation workflow and tech stack'
  ];
  
  findings.forEach((finding, idx) => {
    doc.fontSize(10).fillColor('#000000').text(`${idx + 1}. ${finding}`);
    doc.moveDown(0.3);
  });
  
  doc.moveDown();
  
  if (session.phase6Solution?.proposedSolution) {
    doc.fontSize(11).fillColor('#2d3748').font('Helvetica-Bold')
       .text('Recommended Solution:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#000000').font('Helvetica')
       .text(session.phase6Solution.proposedSolution, 
             { align: 'justify' });
  }
}

/**
 * Add Statistics Dashboard
 */
function addStatisticsDashboard(doc, session) {
  doc.fontSize(24).font('Helvetica-Bold').fillColor('#1a365d')
     .text('Research Statistics', { underline: true });
  doc.moveDown();
  
  // Create stat boxes
  const stats = [
    { icon: '', title: 'Research Papers', value: session.papers?.length || 0, color: '#667eea' },
    { icon: '', title: 'GitHub Projects', value: session.githubProjects?.length || 0, color: '#48bb78' },
    { icon: '', title: 'Applications', value: session.applications?.length || 0, color: '#ed8936' },
    { icon: '', title: 'Subtopics', value: session.subtopics?.length || 0, color: '#9f7aea' }
  ];
  
  const boxWidth = 230;
  const boxHeight = 80;
  const startX = 70;
  let currentX = startX;
  let currentY = doc.y;
  
  stats.forEach((stat, idx) => {
    if (idx === 2) {
      currentX = startX;
      currentY += boxHeight + 20;
    }
    
    // Draw box
    doc.rect(currentX, currentY, boxWidth, boxHeight).fillAndStroke(stat.color + '20', stat.color);
    
    // Icon and title
    doc.fontSize(20).fillColor(stat.color).text(stat.icon, currentX + 15, currentY + 15);
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold')
       .text(stat.title, currentX + 50, currentY + 18, { width: boxWidth - 60 });
    
    // Value
    doc.fontSize(24).fillColor(stat.color).font('Helvetica-Bold')
       .text(stat.value, currentX + 15, currentY + 45, { width: boxWidth - 30, align: 'left' });
    
    currentX += boxWidth + 25;
  });
  
  doc.y = currentY + boxHeight + 30;
  
  // Additional metrics
  doc.fontSize(14).fillColor('#2d3748').font('Helvetica-Bold')
     .text('Phase Completion Status', { underline: true });
  doc.moveDown(0.5);
  
  const phases = ['phase1', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6'];
  phases.forEach((phase, idx) => {
    const status = session.phases[phase]?.status || 'pending';
    const statusIcon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳';
    const statusColor = status === 'completed' ? '#48bb78' : status === 'failed' ? '#f56565' : '#cbd5e0';
    
    doc.fontSize(10).fillColor('#4a5568').font('Helvetica')
       .text(`${statusIcon} Phase ${idx + 1}: `, { continued: true });
    doc.fillColor(statusColor).font('Helvetica-Bold').text(status.toUpperCase());
    doc.moveDown(0.3);
  });
}

/**
 * Add Phase 1 content
 */
function addPhase1(doc, session) {
  addPhaseHeader(doc, 1, 'Prompt Enhancement & Topic Refinement');
  
  if (session.refinedProblem) {
    doc.fontSize(12).fillColor('#2d3748').text('Refined Problem Statement:', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#000000').text(session.refinedProblem, { align: 'justify' });
    doc.moveDown();
  }

  if (session.subtopics && session.subtopics.length > 0) {
    doc.fontSize(12).fillColor('#2d3748').text(`Research Subtopics (${session.subtopics.length}):`, { underline: true });
    doc.moveDown(0.5);
    
    session.subtopics.forEach((subtopic, index) => {
      doc.fontSize(11).fillColor('#1a365d').text(`${index + 1}. ${subtopic.title}`, { continued: false });
      if (subtopic.description) {
        doc.fontSize(9).fillColor('#4a5568').text(`   ${subtopic.description}`, { align: 'justify' });
      }
      doc.moveDown(0.5);
    });
  }
}

/**
 * Add Phase 2 content
 */
function addPhase2(doc, session) {
  addPhaseHeader(doc, 2, 'Research Discovery - Academic Papers, GitHub Projects & Applications');
  
  // === ACADEMIC PAPERS ===
  if (session.papers && session.papers.length > 0) {
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('ACADEMIC PAPERS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`Total Papers Found: ${session.papers.length}`);
    doc.moveDown();

    session.papers.slice(0, 15).forEach((paper, index) => {
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`${index + 1}. ${paper.title || 'Untitled'}`, { continued: false });
      
      doc.fontSize(9).fillColor('#4a5568').font('Helvetica');
      if (paper.authors && paper.authors.length > 0) {
        doc.text(`Authors: ${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}`, { indent: 20 });
      }
      
      if (paper.year) {
        doc.text(`Year: ${paper.year}`, { indent: 20 });
      }

      if (paper.semanticScorePercent) {
        doc.text(`Relevance Score: ${paper.semanticScorePercent}%`, { indent: 20 });
      }

      if (paper.abstract) {
        doc.fontSize(9).fillColor('#000000')
           .text(paper.abstract, { align: 'justify', indent: 20 });
      }

      doc.moveDown(0.8);

      if (doc.y > 700 && index < session.papers.slice(0, 15).length - 1) {
        doc.addPage();
      }
    });
  } else {
    doc.fontSize(10).fillColor('#718096').text('No papers found in this phase.');
  }

  // === GITHUB PROJECTS ===
  if (doc.y > 650) doc.addPage();
  doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('GITHUB PROJECTS', { underline: true });
  doc.moveDown(0.5);
  
  if (session.githubProjects && session.githubProjects.length > 0) {
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`Total GitHub Projects Found: ${session.githubProjects.length}`);
    doc.moveDown();

    session.githubProjects.slice(0, 10).forEach((project, index) => {
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`${index + 1}. ${project.name || project.full_name || 'Untitled Project'}`, { continued: false });
      
      doc.fontSize(9).fillColor('#4a5568').font('Helvetica');
      
      if (project.full_name) {
        doc.text(`Repository: ${project.full_name}`, { indent: 20 });
      }
      
      if (project.stargazers_count !== undefined) {
        doc.text(`Stars: ${project.stargazers_count} | Forks: ${project.forks_count || 0}`, { indent: 20 });
      }
      
      if (project.language) {
        doc.text(`Language: ${project.language}`, { indent: 20 });
      }
      
      if (project.html_url) {
        doc.fillColor('#3182ce').text(`URL: ${project.html_url}`, { indent: 20, link: project.html_url });
        doc.fillColor('#4a5568');
      }

      if (project.description) {
        doc.fontSize(9).fillColor('#000000')
           .text(project.description, { align: 'justify', indent: 20 });
        
        if (doc.y > 700) doc.addPage();
      }
      
      if (project.topics && project.topics.length > 0) {
        doc.fontSize(8).fillColor('#4a5568').text(`Topics: ${project.topics.slice(0, 5).join(', ')}`, { indent: 20 });
      }

      doc.moveDown(0.8);

      if (doc.y > 700 && index < session.githubProjects.slice(0, 10).length - 1) {
        doc.addPage();
      }
    });
  } else {
    doc.fontSize(10).fillColor('#718096').text('No GitHub projects found.');
  }

  // === APPLICATIONS ===
  if (doc.y > 650) doc.addPage();
  doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('EXISTING APPLICATIONS', { underline: true });
  doc.moveDown(0.5);
  
  if (session.applications && session.applications.length > 0) {
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`Total Applications Found: ${session.applications.length}`);
    doc.moveDown();

    session.applications.forEach((app, index) => {
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`${index + 1}. ${app.title || 'Untitled Application'}`, { continued: false });
      
      doc.fontSize(9).fillColor('#000000').font('Helvetica');
      
      if (app.summary) {
        doc.text(app.summary, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
      }

      if (app.features && app.features.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text('Key Features:', { indent: 20 });
        app.features.slice(0, 5).forEach(feature => {
          doc.fontSize(8).fillColor('#000000').text(`• ${feature}`, { indent: 30 });
        });
        doc.moveDown(0.3);
      }
      
      if (app.limitations && app.limitations.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text('Limitations:', { indent: 20 });
        app.limitations.slice(0, 3).forEach(limitation => {
          doc.fontSize(8).fillColor('#000000').text(`• ${limitation}`, { indent: 30 });
        });
        doc.moveDown(0.3);
      }

      if (app.targetUsers) {
        doc.fontSize(9).fillColor('#4a5568').text(`Target Users: ${app.targetUsers}`, { indent: 20 });
      }

      if (app.platformType) {
        doc.fontSize(9).fillColor('#4a5568').text(`Platform: ${app.platformType}`, { indent: 20 });
      }
      
      if (app.officialWebsite) {
        doc.fillColor('#3182ce').text(`Website: ${app.officialWebsite}`, { indent: 20, link: app.officialWebsite });
        doc.fillColor('#4a5568');
      }
      
      if (app.pricingOrLicense) {
        doc.fontSize(9).fillColor('#4a5568').text(`Pricing/License: ${app.pricingOrLicense}`, { indent: 20 });
      }

      doc.moveDown(0.8);

      if (doc.y > 700 && index < session.applications.length - 1) {
        doc.addPage();
      }
    });
    
    if (session.applicationsNotes) {
      doc.moveDown();
      doc.fontSize(11).fillColor('#2d3748').text('Additional Notes:', { underline: true });
      doc.fontSize(9).fillColor('#000000').text(session.applicationsNotes, { align: 'justify' });
    }
  } else {
    doc.fontSize(10).fillColor('#718096').text('No applications found.');
  }
}

/**
 * Add Phase 3 content
 */
function addPhase3(doc, session) {
  addPhaseHeader(doc, 3, 'Deep Analysis & Synthesis');
  
  // === RESEARCH PAPER ANALYSIS ===
  doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('RESEARCH PAPER ANALYSIS', { underline: true });
  doc.moveDown(0.5);
  
  const phase3PaperData = session.phases?.phase3?.researchPaperAnalysis?.data;
  let paperAnalysisToShow = [];
  
  if (phase3PaperData && Array.isArray(phase3PaperData) && phase3PaperData.length > 0) {
    paperAnalysisToShow = phase3PaperData.filter(p => p.summary || p.methodology || p.result);
  } else {
    paperAnalysisToShow = session.papers.filter(p => p.summary || p.methodology);
  }
  
  if (paperAnalysisToShow.length > 0) {
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`Papers Analyzed: ${paperAnalysisToShow.length}`);
    doc.moveDown();

    paperAnalysisToShow.slice(0, 10).forEach((paper, index) => {
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`${index + 1}. ${paper.title || 'Untitled'}`, { continued: false });
      
      doc.fontSize(9).fillColor('#4a5568').font('Helvetica');
      
      if (paper.relevance_reason && Array.isArray(paper.relevance_reason) && paper.relevance_reason.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text('Research Relevance:', { underline: true, indent: 20 });
        paper.relevance_reason.forEach((reason, rIdx) => {
          doc.fontSize(9).fillColor('#000000').text(`• ${reason}`, { indent: 30, align: 'justify' });
        });
        doc.moveDown(0.3);
      }
      
      if (paper.summary) {
        doc.text('Summary:', { underline: true, indent: 20 });
        doc.fontSize(9).fillColor('#000000').text(paper.summary, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
        
        if (doc.y > 700) doc.addPage();
      }

      if (paper.methodology) {
        doc.fontSize(9).fillColor('#4a5568').text('Methodology:', { underline: true, indent: 20 });
        doc.fontSize(9).fillColor('#000000').text(paper.methodology, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
        
        if (doc.y > 700) doc.addPage();
      }

      if (paper.algorithmsUsed && paper.algorithmsUsed.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text(`Algorithms: ${paper.algorithmsUsed.join(', ')}`, { indent: 20 });
        doc.moveDown(0.3);
      }
      
      if (paper.result) {
        doc.fontSize(9).fillColor('#4a5568').text('Results:', { underline: true, indent: 20 });
        doc.fontSize(9).fillColor('#000000').text(paper.result, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
        
        if (doc.y > 700) doc.addPage();
      }

      doc.moveDown(0.8);

      if (doc.y > 700 && index < paperAnalysisToShow.slice(0, 10).length - 1) {
        doc.addPage();
      }
    });
  } else {
    doc.fontSize(10).fillColor('#718096').text('Phase 3 paper analysis is in progress or no data available yet.');
    doc.moveDown();
    
    if (session.papers && session.papers.length > 0) {
      doc.fontSize(10).fillColor('#4a5568').text(`Note: ${session.papers.length} papers were collected in Phase 2 and are being analyzed.`);
    }
  }
  
  // === GITHUB PROJECT ANALYSIS ===
  const phase3GithubData = session.phases?.phase3?.githubAnalysis?.data;
  let githubAnalysisToShow = [];
  
  if (phase3GithubData && Array.isArray(phase3GithubData) && phase3GithubData.length > 0) {
    githubAnalysisToShow = phase3GithubData;
  } else if (session.githubProjects && Array.isArray(session.githubProjects) && session.githubProjects.length > 0) {
    githubAnalysisToShow = session.githubProjects;
  }
  
  // Check if GitHub analysis has meaningful data (not all Untitled Projects)
  const hasMeaningfulGithubData = githubAnalysisToShow.some(p => 
    (p.title && p.title !== 'Untitled Project') || 
    (p.name && p.name !== 'Untitled Project') || 
    p.description || p.summary || p.analysis
  );
  
  if (hasMeaningfulGithubData && githubAnalysisToShow.length > 0) {
    if (doc.y > 650) doc.addPage();
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('GITHUB PROJECT ANALYSIS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`GitHub Projects Analyzed: ${githubAnalysisToShow.length}`);
    doc.moveDown();

    githubAnalysisToShow.slice(0, 8).forEach((project, index) => {
      const projectTitle = project.title || project.name || project.full_name || 'Untitled Project';
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`${index + 1}. ${projectTitle}`, { continued: false });
      
      doc.fontSize(9).fillColor('#4a5568').font('Helvetica');
      
      if (project.description && !project.summary) {
        doc.text('Description:', { underline: true, indent: 20 });
        doc.fontSize(9).fillColor('#000000').text(project.description, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
        
        if (doc.y > 700) doc.addPage();
      }
      
      if (project.summary) {
        doc.text('Summary:', { underline: true, indent: 20 });
        doc.fontSize(9).fillColor('#000000').text(project.summary, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
        
        if (doc.y > 700) doc.addPage();
      }
      
      if (project.analysis) {
        doc.text('Analysis:', { underline: true, indent: 20 });
        doc.fontSize(9).fillColor('#000000').text(project.analysis, { align: 'justify', indent: 20 });
        doc.moveDown(0.3);
        
        if (doc.y > 700) doc.addPage();
      }

      if (project.keyFeatures && project.keyFeatures.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text('Key Features:', { indent: 20 });
        project.keyFeatures.slice(0, 5).forEach(feature => {
          doc.fontSize(8).fillColor('#000000').text(`• ${feature}`, { indent: 30 });
        });
        doc.moveDown(0.3);
      }

      if (project.technologiesUsed && project.technologiesUsed.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text(`Technologies: ${project.technologiesUsed.slice(0, 5).join(', ')}`, { indent: 20 });
      }

      doc.moveDown(0.8);

      if (doc.y > 700 && index < githubAnalysisToShow.slice(0, 8).length - 1) {
        doc.addPage();
      }
    });
  }
  
  // === PHASE 4 ANALYSIS (Methodologies, Technologies, Datasets) ===
  // Only show if there's meaningful data
  const hasResearchPaperAnalysis = session.phase4Analysis?.researchPaperAnalysis && (
    (session.phase4Analysis.researchPaperAnalysis.mostCommonMethodologies && session.phase4Analysis.researchPaperAnalysis.mostCommonMethodologies.length > 0) ||
    (session.phase4Analysis.researchPaperAnalysis.technologyOrAlgorithms && session.phase4Analysis.researchPaperAnalysis.technologyOrAlgorithms.length > 0) ||
    (session.phase4Analysis.researchPaperAnalysis.datasetsUsed && session.phase4Analysis.researchPaperAnalysis.datasetsUsed.length > 0)
  );
  
  const hasGithubAnalysis = session.phase4Analysis?.githubAnalysis && (
    (session.phase4Analysis.githubAnalysis.commonTechnologies && session.phase4Analysis.githubAnalysis.commonTechnologies.length > 0) ||
    (session.phase4Analysis.githubAnalysis.commonArchitecturalPatterns && session.phase4Analysis.githubAnalysis.commonArchitecturalPatterns.length > 0)
  );
  
  if (session.phase4Analysis && (hasResearchPaperAnalysis || hasGithubAnalysis)) {
    if (doc.y > 600) doc.addPage();
    
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('CROSS-ANALYSIS RESULTS', { underline: true });
    doc.moveDown(0.5);
    
    // Research Paper Analysis Results
    if (session.phase4Analysis.researchPaperAnalysis) {
      const analysis = session.phase4Analysis.researchPaperAnalysis;
      
      doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('From Research Papers:');
      doc.moveDown(0.5);
      
      if (analysis.mostCommonMethodologies && analysis.mostCommonMethodologies.length > 0) {
        doc.fontSize(11).fillColor('#4a5568').text('Most Common Methodologies:');
        analysis.mostCommonMethodologies.slice(0, 5).forEach((method, idx) => {
          doc.fontSize(10).fillColor('#000000').text(`${idx + 1}. ${method.title || method}`, { indent: 20 });
          if (method.description) {
            doc.fontSize(9).text(method.description, { indent: 30, align: 'justify' });
          }
          doc.moveDown(0.3);
        });
      }
      
      if (analysis.technologyOrAlgorithms && analysis.technologyOrAlgorithms.length > 0) {
        doc.fontSize(11).fillColor('#4a5568').text('Technologies & Algorithms:');
        doc.fontSize(9).fillColor('#000000').text(analysis.technologyOrAlgorithms.slice(0, 10).join(', '), { indent: 20 });
        doc.moveDown(0.5);
      }
      
      if (analysis.datasetsUsed && analysis.datasetsUsed.length > 0) {
        doc.fontSize(11).fillColor('#4a5568').text('Datasets Used:');
        analysis.datasetsUsed.slice(0, 8).forEach((dataset, idx) => {
          doc.fontSize(9).fillColor('#000000').text(`• ${dataset}`, { indent: 20 });
        });
        doc.moveDown(0.5);
      }
    }
    
    // GitHub Analysis Results
    if (session.phase4Analysis.githubAnalysis) {
      if (doc.y > 650) doc.addPage();
      const analysis = session.phase4Analysis.githubAnalysis;
      
      doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('From GitHub Projects:');
      doc.moveDown(0.5);
      
      if (analysis.mostCommonMethodologies && analysis.mostCommonMethodologies.length > 0) {
        doc.fontSize(11).fillColor('#4a5568').text('Most Common Approaches:');
        analysis.mostCommonMethodologies.slice(0, 5).forEach((method, idx) => {
          doc.fontSize(10).fillColor('#000000').text(`${idx + 1}. ${method.title || method}`, { indent: 20 });
          if (method.description) {
            doc.fontSize(9).text(method.description, { indent: 30, align: 'justify' });
          }
          doc.moveDown(0.3);
        });
      }
      
      if (analysis.technologyOrAlgorithms && analysis.technologyOrAlgorithms.length > 0) {
        doc.fontSize(11).fillColor('#4a5568').text('Technologies & Algorithms:');
        doc.fontSize(9).fillColor('#000000').text(analysis.technologyOrAlgorithms.slice(0, 10).join(', '), { indent: 20 });
        doc.moveDown(0.5);
      }
    }
  }
}

/**
 * Add Phase 4 Gap Analysis content (NEW)
 */
function addPhase4GapAnalysis(doc, session) {
  addPhaseHeader(doc, 4, 'Gap Analysis - Research Opportunities');
  
  let gapAnalysis = session.phase4GapAnalysis;
  
  // If it's an array, get the first element
  if (Array.isArray(gapAnalysis) && gapAnalysis.length > 0) {
    gapAnalysis = gapAnalysis[0];
  }

  if (!gapAnalysis) {
    doc.fontSize(10).fillColor('#718096').text('No gap analysis data available.');
    return;
  }

  // === EVIDENCE-BASED GAPS ===
  if (gapAnalysis.evidence_based_gaps && gapAnalysis.evidence_based_gaps.length > 0) {
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('EVIDENCE-BASED RESEARCH GAPS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#2d3748').text(`Found ${gapAnalysis.evidence_based_gaps.length} evidence-based gaps:`);
    doc.moveDown(0.5);
    
    gapAnalysis.evidence_based_gaps.forEach((item, idx) => {
      doc.fontSize(10).fillColor('#1a365d').font('Helvetica-Bold').text(`${idx + 1}. `, { continued: true });
      doc.fillColor('#000000').font('Helvetica').text(item.gap || item, { align: 'justify' });
      
      doc.moveDown(0.5);
      
      if (doc.y > 700 && idx < gapAnalysis.evidence_based_gaps.length - 1) {
        doc.addPage();
      }
    });
  }

  // === RESEARCH GAPS FROM PAPERS WITH EVIDENCE ===
  if (gapAnalysis.research_gaps_from_papers && gapAnalysis.research_gaps_from_papers.length > 0) {
    if (doc.y > 600) doc.addPage();
    
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('RESEARCH GAPS FROM PAPERS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#2d3748').text(`Identified ${gapAnalysis.research_gaps_from_papers.length} gaps with supporting evidence:`);
    doc.moveDown(0.5);
    
    gapAnalysis.research_gaps_from_papers.forEach((item, idx) => {
      const gapText = typeof item === 'string' ? item : item.gap;
      
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold').text(`${idx + 1}. ${gapText}`, { align: 'justify' });
      doc.moveDown(0.3);
      
      if (item.evidence && Array.isArray(item.evidence) && item.evidence.length > 0) {
        doc.fontSize(9).fillColor('#4a5568').text(`Supporting Evidence (${item.evidence.length} papers):`, { indent: 20 });
        doc.moveDown(0.2);
        
        item.evidence.slice(0, 3).forEach((ev, evIdx) => {
          doc.fontSize(9).fillColor('#2d3748').font('Helvetica-Bold')
             .text(`Paper: ${ev.paper || 'Unknown'}`, { indent: 30 });
          doc.fontSize(8).fillColor('#000000').font('Helvetica-Oblique')
             .text(`"${ev.limitation_reference || ''}"`, 
                   { indent: 35, align: 'justify' });
          doc.moveDown(0.3);
          
          if (doc.y > 700) doc.addPage();
        });
        
        if (item.evidence.length > 3) {
          doc.fontSize(8).fillColor('#718096').text(`+ ${item.evidence.length - 3} more papers...`, { indent: 30 });
        }
      }
      
      doc.moveDown(0.7);
      
      if (doc.y > 680 && idx < gapAnalysis.research_gaps_from_papers.length - 1) {
        doc.addPage();
      }
    });
  }

  // === AI PREDICTED GAPS ===
  if (gapAnalysis.ai_predicted_possible_gaps && gapAnalysis.ai_predicted_possible_gaps.length > 0) {
    if (doc.y > 650) doc.addPage();
    
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('AI-PREDICTED POSSIBLE GAPS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#2d3748').text(`AI identified ${gapAnalysis.ai_predicted_possible_gaps.length} potential research opportunities:`);
    doc.moveDown(0.5);
    
    gapAnalysis.ai_predicted_possible_gaps.forEach((item, idx) => {
      const gapText = item.predicted_gap || item;
      doc.fontSize(10).fillColor('#1a365d').font('Helvetica-Bold').text(`${idx + 1}. `, { continued: true });
      doc.fillColor('#000000').font('Helvetica').text(gapText, { align: 'justify' });
      
      if (item.reasoning) {
        doc.fontSize(9).fillColor('#4a5568').text(`   Reasoning: ${item.reasoning}`, { indent: 20, align: 'justify' });
      }
      
      doc.moveDown(0.5);
      
      if (doc.y > 720 && idx < gapAnalysis.ai_predicted_possible_gaps.length - 1) {
        doc.addPage();
      }
    });
  }
  
}

/**
 * Add Phase 5 Literature Review content (NEW)
 */
function addPhase5LiteratureReview(doc, session) {
  addPhaseHeader(doc, 5, 'Literature Review - Academic Trends & Synthesis');
  
  const literatureReview = session.phase5LiteratureReview;

  if (!literatureReview) {
    doc.fontSize(10).fillColor('#718096').text('No literature review data available.');
    return;
  }

  // === COMPREHENSIVE LITERATURE REVIEW ===
  if (literatureReview.literature_review) {
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('COMPREHENSIVE LITERATURE REVIEW', { underline: true });
    doc.moveDown(0.5);
    
    // Clean and format the literature review text
    const reviewText = literatureReview.literature_review;
    const paragraphs = reviewText.split('\n\n').filter(p => p.trim().length > 0);
    
    // Track if we're in the "Limitations" section to skip it
    let skipSection = false;
    
    paragraphs.forEach((para, idx) => {
      // Check if it's a heading
      if (para.startsWith('###')) {
        const heading = para.replace(/^###\s*/, '').replace(/\*\*/g, '');
        
        // Check if this is the Limitations section
        if (heading.toLowerCase().includes('limitations of the available literature') || 
            heading.toLowerCase().includes('limitations of available literature')) {
          skipSection = true;
          return; // Skip this heading
        } else {
          skipSection = false; // Reset for other sections
        }
        
        doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text(heading);
        doc.moveDown(0.5);
      } else if (!skipSection) {
        if (para.startsWith('**') && para.endsWith('**')) {
          const boldText = para.replace(/\*\*/g, '');
          doc.fontSize(11).fillColor('#2d3748').font('Helvetica-Bold').text(boldText);
          doc.moveDown(0.3);
        } else if (para.match(/^\d+\.\s+/) || para.match(/^\*\s+/)) {
          // List item
          const cleanText = para.replace(/^\d+\.\s+/, '').replace(/^\*\s+/, '').replace(/\*\*/g, '');
          doc.fontSize(10).fillColor('#000000').font('Helvetica').text(`• ${cleanText}`, { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
        } else {
          // Regular paragraph - handle bold text
          const cleanText = para.replace(/\*\*/g, '');
          doc.fontSize(10).fillColor('#000000').font('Helvetica').text(cleanText, { align: 'justify' });
          doc.moveDown(0.5);
        }
      }
      
      // Add page break if needed
      if (doc.y > 700 && idx < paragraphs.length - 1) {
        doc.addPage();
      }
    });
  }

  // === ACADEMIC TRENDS ===
  if (literatureReview.academic_trends && literatureReview.academic_trends.length > 0) {
    if (doc.y > 650) doc.addPage();
    
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('ACADEMIC RESEARCH TRENDS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#2d3748').text(`Identified ${literatureReview.academic_trends.length} key trends:`);
    doc.moveDown(0.5);
    
    literatureReview.academic_trends.forEach((trend, idx) => {
      doc.fontSize(10).fillColor('#1a365d').font('Helvetica-Bold').text(`${idx + 1}. `, { continued: true });
      doc.fillColor('#000000').font('Helvetica').text(trend, { align: 'justify' });
      doc.moveDown(0.4);
      
      if (doc.y > 720 && idx < literatureReview.academic_trends.length - 1) {
        doc.addPage();
      }
    });
  }
  
  // === EMERGING THEMES (if available) ===
  if (literatureReview.emerging_themes && literatureReview.emerging_themes.length > 0) {
    doc.moveDown();
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('EMERGING THEMES:', { underline: true });
    doc.moveDown(0.3);
    
    literatureReview.emerging_themes.forEach((theme, idx) => {
      doc.fontSize(10).fillColor('#000000').text(`• ${theme}`, { align: 'justify', indent: 20 });
      doc.moveDown(0.3);
    });
  }
}

/**
 * Add Phase 6 Best Solution content
 */
function addPhase6(doc, session) {
  addPhaseHeader(doc, 6, 'Best Solution & Implementation Roadmap');
  
  const solution = session.phase6Solution;

  if (!solution) {
    doc.fontSize(10).fillColor('#718096').text('Best solution not yet generated.');
    return;
  }

  // === PROPOSED SOLUTION ===
  if (solution.proposedSolution) {
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('PROPOSED SOLUTION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000').font('Helvetica').text(solution.proposedSolution, { align: 'justify' });
    doc.moveDown();
  }

  // === PROBLEM UNDERSTANDING ===
  if (solution.problemUnderstanding) {
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('PROBLEM UNDERSTANDING', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#000000').font('Helvetica').text(solution.problemUnderstanding, { align: 'justify' });
    doc.moveDown();
  }

  // === SOLUTION ARCHITECTURE ===
  if (solution.solutionArchitecture && solution.solutionArchitecture.length > 0) {
    if (doc.y > 650) doc.addPage();
    
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('SOLUTION ARCHITECTURE', { underline: true });
    doc.moveDown(0.5);
    
    solution.solutionArchitecture.forEach((item, idx) => {
      doc.fontSize(10).fillColor('#000000').text(`${idx + 1}. ${item}`, { align: 'justify', indent: 20 });
      doc.moveDown(0.3);
    });
    doc.moveDown();
  }

  // === IMPLEMENTATION WORKFLOW ===
  if (solution.implementationWorkflow && solution.implementationWorkflow.length > 0) {
    if (doc.y > 600) doc.addPage();
    
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('IMPLEMENTATION WORKFLOW', { underline: true });
    doc.moveDown(0.5);
    
    solution.implementationWorkflow.forEach((phase, idx) => {
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`Phase ${idx + 1}: ${phase.phaseTitle || 'Implementation Step'}`, { underline: true });
      doc.moveDown(0.3);
      
      if (phase.steps && phase.steps.length > 0) {
        phase.steps.forEach((step, sIdx) => {
          doc.fontSize(9).fillColor('#000000').font('Helvetica')
             .text(`${sIdx + 1}. ${step}`, { align: 'justify', indent: 30 });
          doc.moveDown(0.2);
        });
      }
      doc.moveDown(0.5);
      
      if (doc.y > 700 && idx < solution.implementationWorkflow.length - 1) {
        doc.addPage();
      }
    });
  }

  // === RECOMMENDED TECH STACK ===
  if (solution.recommendedTechStack && solution.recommendedTechStack.length > 0) {
    if (doc.y > 650) doc.addPage();
    
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('RECOMMENDED TECH STACK', { underline: true });
    doc.moveDown(0.5);
    
    solution.recommendedTechStack.forEach((stack, idx) => {
      doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
         .text(stack.title || 'Tech Category', { underline: true });
      doc.moveDown(0.3);
      
      if (stack.items && stack.items.length > 0) {
        stack.items.forEach((item, iIdx) => {
          doc.fontSize(9).fillColor('#000000').font('Helvetica')
             .text(`• ${item}`, { indent: 30 });
          doc.moveDown(0.2);
        });
      }
      doc.moveDown(0.5);
    });
  }

  // === SCORING BY FACTORS ===
  if (solution.scoringByFactors && solution.scoringByFactors.length > 0) {
    if (doc.y > 600) doc.addPage();
    
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('SCORING BY FACTORS', { underline: true });
    doc.moveDown(0.5);
    
    solution.scoringByFactors.forEach((score, idx) => {
      doc.fontSize(10).fillColor('#1a365d').font('Helvetica-Bold')
         .text(`${score.title || 'Factor'}: `, { continued: true });
      
      // Color code the rating
      const rating = score.rating || 0;
      const ratingColor = rating >= 8 ? '#48bb78' : rating >= 6 ? '#ed8936' : '#f56565';
      doc.fillColor(ratingColor).font('Helvetica-Bold').text(`${rating}/10`);
      
      if (score.description) {
        doc.fontSize(9).fillColor('#4a5568').font('Helvetica')
           .text(score.description, { indent: 20, align: 'justify' });
      }
      doc.moveDown(0.5);
    });
  }

  // === LIMITATIONS & OPEN QUESTIONS ===
  if (solution.limitations && solution.limitations.length > 0) {
    if (doc.y > 650) doc.addPage();
    
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('LIMITATIONS & OPEN QUESTIONS', { underline: true });
    doc.moveDown(0.5);
    
    solution.limitations.forEach((limitation, idx) => {
      doc.fontSize(9).fillColor('#000000').text(`${idx + 1}. ${limitation}`, { align: 'justify', indent: 20 });
      doc.moveDown(0.3);
    });
    doc.moveDown();
  }

  // === ADDITIONAL INFORMATION ===
  if (solution.additionalInformation && solution.additionalInformation.length > 0) {
    doc.fontSize(12).fillColor('#2d3748').font('Helvetica-Bold').text('ADDITIONAL INFORMATION', { underline: true });
    doc.moveDown(0.5);
    
    solution.additionalInformation.forEach((info, idx) => {
      doc.fontSize(9).fillColor('#000000').text(`• ${info}`, { align: 'justify', indent: 20 });
      doc.moveDown(0.3);
    });
  }
  
  // === COMPLETION BADGE ===
  doc.moveDown(2);
  const badgeY = doc.y;
  doc.rect(100, badgeY, 395, 60).fillAndStroke('#48bb7820', '#48bb78');
  doc.fontSize(14).fillColor('#22543d').font('Helvetica-Bold')
     .text('RESEARCH ANALYSIS COMPLETE', 110, badgeY + 20, { align: 'center', width: 375 });
  doc.fontSize(9).fillColor('#2f855a').font('Helvetica')
     .text('All 6 phases successfully completed with comprehensive insights', 110, badgeY + 40, { align: 'center', width: 375 });
}

/**
 * Helper function to add phase headers
 */
function addPhaseHeader(doc, phaseNumber, phaseTitle) {
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a365d')
     .text(`Phase ${phaseNumber}: ${phaseTitle}`, { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor('#cbd5e0')
     .text('_'.repeat(100));
  doc.moveDown(0.8);
}
