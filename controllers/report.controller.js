import PDFDocument from 'pdfkit';
import ResearchSession from '../models/ResearchSession.model.js';

/**
 * Generate comprehensive PDF report for research session (Phases 1-6 only)
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

    // ========== COVER PAGE ==========
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

    // ========== PHASE 1: PROMPT ENHANCEMENT ==========
    doc.addPage();
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

    // ========== PHASE 2: RESEARCH DISCOVERY ==========
    if (doc.y > 650) doc.addPage();
    addPhaseHeader(doc, 2, 'Research Discovery - Academic Papers, GitHub Projects & Applications');
    
    // === ACADEMIC PAPERS ===
    if (session.papers && session.papers.length > 0) {
      doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('📄 Academic Papers', { underline: true });
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
             .text(paper.abstract.substring(0, 300) + '...', { align: 'justify', indent: 20 });
        }

        doc.moveDown(0.8);

        // Add page break only if very close to bottom
        if (doc.y > 720 && index < session.papers.slice(0, 15).length - 1) {
          doc.addPage();
        }
      });
    } else {
      doc.fontSize(10).fillColor('#718096').text('No papers found in this phase.');
    }

    // === GITHUB PROJECTS ===
    if (doc.y > 650) doc.addPage();
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('💻 GitHub Projects', { underline: true });
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
          doc.text(`⭐ Stars: ${project.stargazers_count} | 🍴 Forks: ${project.forks_count || 0}`, { indent: 20 });
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
             .text(project.description.substring(0, 250) + (project.description.length > 250 ? '...' : ''), { align: 'justify', indent: 20 });
        }
        
        if (project.topics && project.topics.length > 0) {
          doc.fontSize(8).fillColor('#4a5568').text(`Topics: ${project.topics.slice(0, 5).join(', ')}`, { indent: 20 });
        }

        doc.moveDown(0.8);

        if (doc.y > 720 && index < session.githubProjects.slice(0, 10).length - 1) {
          doc.addPage();
        }
      });
    } else {
      doc.fontSize(10).fillColor('#718096').text('No GitHub projects found.');
    }

    // === APPLICATIONS ===
    if (doc.y > 650) doc.addPage();
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('🚀 Existing Applications', { underline: true });
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

    // ========== PHASE 3: ANALYSIS & SYNTHESIS ==========
    if (doc.y > 650) doc.addPage();
    addPhaseHeader(doc, 3, 'Deep Analysis & Synthesis');
    
    // === RESEARCH PAPER ANALYSIS ===
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('📄 Research Paper Analysis', { underline: true });
    doc.moveDown(0.5);
    
    // Try to get analysis data from phase3 data structure first
    const phase3PaperData = session.phases?.phase3?.researchPaperAnalysis?.data;
    let paperAnalysisToShow = [];
    
    if (phase3PaperData && Array.isArray(phase3PaperData) && phase3PaperData.length > 0) {
      // Use phase3 stored data
      paperAnalysisToShow = phase3PaperData.filter(p => p.summary || p.methodology || p.result);
    } else {
      // Fallback to enriched papers
      paperAnalysisToShow = session.papers.filter(p => p.summary || p.methodology);
    }
    
    if (paperAnalysisToShow.length > 0) {
      doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`Papers Analyzed: ${paperAnalysisToShow.length}`);
      doc.moveDown();

      paperAnalysisToShow.slice(0, 10).forEach((paper, index) => {
        doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
           .text(`${index + 1}. ${paper.title || 'Untitled'}`, { continued: false });
        
        doc.fontSize(9).fillColor('#4a5568').font('Helvetica');
        
        if (paper.summary) {
          doc.text('Summary:', { underline: true, indent: 20 });
          doc.fontSize(9).fillColor('#000000').text(paper.summary.substring(0, 500) + (paper.summary.length > 500 ? '...' : ''), { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
        }

        if (paper.methodology) {
          doc.fontSize(9).fillColor('#4a5568').text('Methodology:', { underline: true, indent: 20 });
          doc.fontSize(9).fillColor('#000000').text(paper.methodology.substring(0, 400) + (paper.methodology.length > 400 ? '...' : ''), { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
        }

        if (paper.algorithmsUsed && paper.algorithmsUsed.length > 0) {
          doc.fontSize(9).fillColor('#4a5568').text(`Algorithms: ${paper.algorithmsUsed.slice(0, 5).join(', ')}`, { indent: 20 });
          doc.moveDown(0.3);
        }
        
        if (paper.result) {
          doc.fontSize(9).fillColor('#4a5568').text('Results:', { underline: true, indent: 20 });
          doc.fontSize(9).fillColor('#000000').text(paper.result.substring(0, 300) + (paper.result.length > 300 ? '...' : ''), { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
        }

        doc.moveDown(0.8);

        if (doc.y > 700 && index < paperAnalysisToShow.slice(0, 10).length - 1) {
          doc.addPage();
        }
      });
    } else {
      doc.fontSize(10).fillColor('#718096').text('Phase 3 paper analysis is in progress or no data available yet.');
      doc.moveDown();
      
      // Show Phase 2 papers as fallback
      if (session.papers && session.papers.length > 0) {
        doc.fontSize(10).fillColor('#4a5568').text(`Note: ${session.papers.length} papers were collected in Phase 2 and are being analyzed.`);
      }
    }
    
    // === GITHUB PROJECT ANALYSIS ===
    if (doc.y > 650) doc.addPage();
    doc.fontSize(14).fillColor('#1a365d').font('Helvetica-Bold').text('💻 GitHub Project Analysis', { underline: true });
    doc.moveDown(0.5);
    
    // Try to get analysis data from phase3 data structure first
    const phase3GithubData = session.phases?.phase3?.githubAnalysis?.data;
    let githubAnalysisToShow = [];
    
    if (phase3GithubData && Array.isArray(phase3GithubData) && phase3GithubData.length > 0) {
      // Use phase3 stored data - show all projects
      githubAnalysisToShow = phase3GithubData;
    } else if (session.githubProjects && Array.isArray(session.githubProjects) && session.githubProjects.length > 0) {
      // Fallback to githubProjects array - show all projects
      githubAnalysisToShow = session.githubProjects;
    }
    
    if (githubAnalysisToShow.length > 0) {
      doc.fontSize(12).fillColor('#2d3748').font('Helvetica').text(`GitHub Projects Analyzed: ${githubAnalysisToShow.length}`);
      doc.moveDown();

      githubAnalysisToShow.slice(0, 8).forEach((project, index) => {
        const projectTitle = project.title || project.name || project.full_name || 'Untitled Project';
        doc.fontSize(11).fillColor('#1a365d').font('Helvetica-Bold')
           .text(`${index + 1}. ${projectTitle}`, { continued: false });
        
        doc.fontSize(9).fillColor('#4a5568').font('Helvetica');
        
        // Show description if available (common in Phase 2 data)
        if (project.description && !project.summary) {
          doc.text('Description:', { underline: true, indent: 20 });
          doc.fontSize(9).fillColor('#000000').text(project.description.substring(0, 400) + (project.description.length > 400 ? '...' : ''), { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
        }
        
        if (project.summary) {
          doc.text('Summary:', { underline: true, indent: 20 });
          doc.fontSize(9).fillColor('#000000').text(project.summary.substring(0, 400) + (project.summary.length > 400 ? '...' : ''), { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
        }
        
        if (project.analysis) {
          doc.text('Analysis:', { underline: true, indent: 20 });
          doc.fontSize(9).fillColor('#000000').text(project.analysis.substring(0, 400) + (project.analysis.length > 400 ? '...' : ''), { align: 'justify', indent: 20 });
          doc.moveDown(0.3);
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
    } else {
      doc.fontSize(10).fillColor('#718096').text('Phase 3 GitHub analysis is in progress or no data available yet.');
      doc.moveDown();
      
      // Show Phase 2 GitHub projects as fallback
      if (session.githubProjects && session.githubProjects.length > 0) {
        doc.fontSize(10).fillColor('#4a5568').text(`Note: ${session.githubProjects.length} GitHub projects were collected in Phase 2 and are being analyzed.`);
      }
    }

    // ========== PHASE 4: BEST SOLUTION ==========
    if (doc.y > 650) doc.addPage();
    addPhaseHeader(doc, 4, 'Best Solution & Recommendations');
    
    if (session.phase6Solution) {
      const solution = session.phase6Solution;

      if (solution.proposedSolution) {
        doc.fontSize(12).fillColor('#2d3748').text('Proposed Solution:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#000000').text(solution.proposedSolution, { align: 'justify' });
        doc.moveDown();
      }

      if (solution.problemUnderstanding) {
        doc.fontSize(12).fillColor('#2d3748').text('Problem Understanding:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#000000').text(solution.problemUnderstanding, { align: 'justify' });
        doc.moveDown();
      }

      if (solution.solutionArchitecture && solution.solutionArchitecture.length > 0) {
        doc.fontSize(12).fillColor('#2d3748').text('Solution Architecture:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#000000').list(solution.solutionArchitecture);
        doc.moveDown();
      }

      if (solution.implementationWorkflow && solution.implementationWorkflow.length > 0) {
        doc.fontSize(12).fillColor('#2d3748').text('Implementation Workflow:', { underline: true });
        doc.moveDown(0.5);
        solution.implementationWorkflow.forEach((phase, index) => {
          doc.fontSize(10).fillColor('#1a365d').text(`Phase ${index + 1}: ${phase.phaseTitle || 'Step'}`, { underline: true });
          if (phase.steps && phase.steps.length > 0) {
            doc.fontSize(9).fillColor('#000000').list(phase.steps);
          }
          doc.moveDown(0.5);
        });
      }

      if (doc.y > 700) doc.addPage();

      if (solution.recommendedTechStack && solution.recommendedTechStack.length > 0) {
        doc.fontSize(12).fillColor('#2d3748').text('Recommended Tech Stack:', { underline: true });
        doc.moveDown(0.5);
        solution.recommendedTechStack.forEach(stack => {
          doc.fontSize(10).fillColor('#1a365d').text(stack.title || 'Category', { underline: true });
          if (stack.items && stack.items.length > 0) {
            doc.fontSize(9).fillColor('#000000').list(stack.items);
          }
          doc.moveDown(0.5);
        });
      }

      if (solution.scoringByFactors && solution.scoringByFactors.length > 0) {
        doc.fontSize(12).fillColor('#2d3748').text('Scoring by Factors:', { underline: true });
        doc.moveDown(0.5);
        solution.scoringByFactors.forEach(score => {
          doc.fontSize(10).fillColor('#1a365d').text(`${score.title || 'Factor'}: ${score.rating || 'N/A'}/10`);
          if (score.description) {
            doc.fontSize(9).fillColor('#4a5568').text(`   ${score.description}`, { align: 'justify' });
          }
          doc.moveDown(0.3);
        });
        doc.moveDown();
      }

      if (solution.limitations && solution.limitations.length > 0) {
        doc.fontSize(12).fillColor('#2d3748').text('Limitations & Open Questions:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('#000000').list(solution.limitations);
        doc.moveDown();
      }

      if (solution.additionalInformation && solution.additionalInformation.length > 0) {
        doc.fontSize(12).fillColor('#2d3748').text('Additional Information:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(9).fillColor('#000000').list(solution.additionalInformation);
      }
    } else {
      doc.fontSize(10).fillColor('#718096').text('Best solution not yet generated.');
    }

    // Add page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).fillColor('#718096')
         .text(`Page ${i + 1} of ${pages.count}`, 
           50, doc.page.height - 50, 
           { align: 'center' });
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

/**
 * Helper function to add phase headers
 */
function addPhaseHeader(doc, phaseNumber, phaseTitle) {
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1a365d')
     .text(`Phase ${phaseNumber}: ${phaseTitle}`, { underline: true });
  doc.moveDown();
  doc.fontSize(8).fillColor('#cbd5e0')
     .text('_'.repeat(100));
  doc.moveDown(0.5);
}
