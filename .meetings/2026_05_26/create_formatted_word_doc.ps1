# PowerShell script to create properly formatted Word document for Bob Jett Meeting
$docxPath = "C:\Users\RussConner\OneDrive - IBM\Documents\.git\.meetings\2026_05_26\Bob Jett Meeting - Technical Summary.docx"

try {
    # Create Word application object
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    
    # Create new document
    $doc = $word.Documents.Add()
    $selection = $word.Selection
    
    # Helper function to add heading
    function Add-Heading($text, $level) {
        $selection.Style = "Heading $level"
        $selection.TypeText($text)
        $selection.TypeParagraph()
    }
    
    # Helper function to add normal text
    function Add-Text($text) {
        $selection.Style = "Normal"
        $selection.TypeText($text)
        $selection.TypeParagraph()
    }
    
    # Helper function to add indented text
    function Add-IndentedText($text) {
        $selection.Style = "Normal"
        $selection.ParagraphFormat.LeftIndent = 36
        $selection.TypeText($text)
        $selection.TypeParagraph()
        $selection.ParagraphFormat.LeftIndent = 0
    }
    
    # Title
    $selection.Font.Size = 16
    $selection.Font.Bold = $true
    $selection.TypeText("Meeting Summary - Technical Analysis")
    $selection.TypeParagraph()
    
    $selection.Font.Size = 14
    $selection.TypeText("Bob Jett - Bungie Organizational Changes & AI Strategy Discussion")
    $selection.TypeParagraph()
    
    $selection.Font.Size = 11
    $selection.Font.Bold = $false
    $selection.TypeText("Date: May 26, 2026")
    $selection.TypeParagraph()
    $selection.TypeParagraph()
    
    # Executive Summary
    Add-Heading "Executive Summary" 1
    Add-Text "Strategic discussion with Bob Jett (Data Protection Officer at Bungie) regarding organizational restructuring, AI implementation challenges, and potential IBM engagement opportunities around data architecture, governance, and AI strategy during a period of significant organizational change."
    $selection.TypeParagraph()
    
    # Key Deliverables
    Add-Heading "Key Deliverables" 1
    
    Add-Heading "1. IBM Client Zero Demonstration" 2
    Add-IndentedText "Scope: Showcase IBM's internal AI implementation journey"
    Add-IndentedText "Focus Areas:"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Procurement process improvements"
    Add-IndentedText "HR and IT back-office optimization"
    Add-IndentedText "Data architecture and governance frameworks"
    Add-IndentedText "Practical AI implementation lessons learned"
    $selection.ParagraphFormat.LeftIndent = 0
    Add-IndentedText "Value Proposition: Learn from IBM's experiences with AI adoption challenges and successes"
    Add-IndentedText "Audience: Bob Jett, John (Global Records & Information Management Manager), IBM team"
    $selection.TypeParagraph()
    
    Add-Heading "2. Data Architecture & Governance Consultation" 2
    Add-IndentedText "Scope: Educational sessions on data foundation and governance"
    Add-IndentedText "Key Topics:"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Data architecture best practices"
    Add-IndentedText "AI architecture frameworks"
    Add-IndentedText "Records and information management"
    Add-IndentedText "Data governance in manufacturing context"
    $selection.ParagraphFormat.LeftIndent = 0
    Add-IndentedText "Stakeholders: Bob Jett (Data Protection Officer), John (Global Records & Information Management Manager), Lauren (IBM Data & AI Lead), Dom and Russ (IBM Account Team)"
    $selection.TypeParagraph()
    
    Add-Heading "3. AI Strategy Advisory" 2
    Add-IndentedText "Challenge: Bungie experiencing 'FOMO-driven' AI initiatives"
    Add-IndentedText "Need: Strategic guidance on practical AI applications for manufacturing"
    Add-IndentedText "Focus: Manufacturing-specific use cases vs. content generation"
    Add-IndentedText "Deliverable: Framework for evaluating AI initiatives aligned with business value"
    $selection.TypeParagraph()
    
    Add-Heading "4. Organizational Change Support" 2
    Add-IndentedText "Context: Major restructuring combining Business Intelligence/Analytics with Architecture"
    Add-IndentedText "Risk: Historical challenges with this organizational model"
    Add-IndentedText "Support Needed: Navigate new organizational structure and identify key stakeholders"
    Add-IndentedText "Ongoing: Flexible engagement model during transition period"
    $selection.TypeParagraph()
    
    # Timeline & Milestones
    Add-Heading "Timeline & Milestones" 1
    
    Add-Heading "Immediate Actions (Week of May 26)" 2
    Add-IndentedText "Status: Initial discussion completed"
    Add-IndentedText "Next Step: Schedule Client Zero demo"
    Add-IndentedText "Participants: Bob Jett, John, IBM team (Dom, Russ, Lauren, Jason)"
    $selection.TypeParagraph()
    
    Add-Heading "Short-term (June 8-9, 2026)" 2
    Add-IndentedText "Deliverable: IBM Client Zero demonstration"
    Add-IndentedText "Location: Virtual meeting"
    Add-IndentedText "Objectives:"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Showcase IBM's AI implementation journey"
    Add-IndentedText "Demonstrate back-office process improvements"
    Add-IndentedText "Share lessons learned and best practices"
    Add-IndentedText "Introduce John to IBM team"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-Heading "Mid-term (June 10-30, 2026)" 2
    Add-IndentedText "Bob's Schedule:"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "June 10-12: Future of Privacy Forum annual meeting (Washington D.C.)"
    Add-IndentedText "Mid-June: Week at Bungie HQ (St. Louis)"
    Add-IndentedText "Late June: Europe trip (Rotterdam area, approximately June 25)"
    $selection.ParagraphFormat.LeftIndent = 0
    Add-IndentedText "Constraint: Limited availability due to travel and meetings"
    Add-IndentedText "Opportunity: Bob will gain clarity on his role and organizational direction by end of June"
    $selection.TypeParagraph()
    
    Add-Heading "Long-term (July 2026+)" 2
    Add-IndentedText "Milestone: Organizational structure finalized"
    Add-IndentedText "Deliverable: Reassess engagement strategy based on new org structure"
    Add-IndentedText "Focus: Identify new stakeholders and decision-makers"
    Add-IndentedText "Ongoing: Continuous support and advisory services"
    $selection.TypeParagraph()
    
    # SWOT Analysis
    Add-Heading "SWOT Analysis" 1
    
    Add-Heading "Strengths" 2
    Add-IndentedText "1. Established Relationship"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Long-standing relationship with Bob Jett"
    Add-IndentedText "Trust and open communication established"
    Add-IndentedText "IBM team (Dom, Russ, Jason) familiar with Bungie context"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "2. IBM's Proven Experience"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Client Zero: Real-world AI implementation case study"
    Add-IndentedText "Documented successes and failures to learn from"
    Add-IndentedText "Practical approach to back-office improvements"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "3. Relevant Expertise"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Lauren's data and AI governance specialization"
    Add-IndentedText "Manufacturing industry understanding"
    Add-IndentedText "Data architecture and records management capabilities"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "4. Flexible Engagement Model"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Willingness to pivot with organizational changes"
    Add-IndentedText "Educational approach vs. hard sales"
    Add-IndentedText "Multiple entry points (data, AI, governance)"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-Heading "Weaknesses" 2
    Add-IndentedText "1. Organizational Uncertainty"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Bob's role potentially at risk"
    Add-IndentedText "Key contacts have retired or moved to new roles"
    Add-IndentedText "Unclear decision-making authority during transition"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "2. Limited Current Engagement"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "No active projects or commitments"
    Add-IndentedText "Relationship maintenance mode only"
    Add-IndentedText "Uncertain budget or purchasing authority"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "3. Timing Challenges"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Bob heavily traveling throughout June"
    Add-IndentedText "Organizational changes creating distraction"
    Add-IndentedText "Delayed decision-making likely"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "4. Unclear Value Proposition"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Bungie's AI needs not well-defined"
    Add-IndentedText "Manufacturing use cases different from typical AI applications"
    Add-IndentedText "FOMO-driven initiatives may lack strategic focus"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-Heading "Opportunities" 2
    Add-IndentedText "1. Educational Entry Point"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "New organizational leaders may need education"
    Add-IndentedText "Data architecture/governance knowledge gaps"
    Add-IndentedText "AI strategy guidance during formative period"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "2. Client Zero Differentiation"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Unique story of IBM's internal transformation"
    Add-IndentedText "Practical lessons vs. theoretical consulting"
    Add-IndentedText "Relatable challenges and solutions"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "3. Expanded Stakeholder Network"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Introduction to John (Global Records & Information Management)"
    Add-IndentedText "Access to new organizational leaders post-restructuring"
    Add-IndentedText "Potential connections at St. Louis HQ"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "4. Manufacturing-Specific AI Applications"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Procurement optimization"
    Add-IndentedText "Logistics and supply chain improvements"
    Add-IndentedText "Back-office process automation"
    Add-IndentedText "Data governance for commodity trading"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "5. Long-term Advisory Role"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Ongoing organizational changes create sustained need"
    Add-IndentedText "Data governance becoming more critical"
    Add-IndentedText "AI strategy guidance as initiatives mature"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-Heading "Threats" 2
    Add-IndentedText "1. Role Elimination Risk"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Bob may not have a role in coming months"
    Add-IndentedText "Loss of primary contact and champion"
    Add-IndentedText "Need to rebuild relationships from scratch"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "2. Organizational Restructuring Impact"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "BI/Analytics + Architecture combination historically problematic"
    Add-IndentedText "Potential for failed initiatives and budget cuts"
    Add-IndentedText "Decision-making paralysis during transition"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "3. FOMO-Driven AI Initiatives"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Lack of strategic focus on AI projects"
    Add-IndentedText "Potential for failed implementations damaging IBM's reputation"
    Add-IndentedText "Executive pressure without clear business case"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "4. Competitive Positioning"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Other vendors may be better positioned with new leadership"
    Add-IndentedText "Existing relationships may not transfer to new org structure"
    Add-IndentedText "Budget constraints during restructuring"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "5. Manufacturing Industry Challenges"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Limited applicability of generative AI to physical operations"
    Add-IndentedText "Commodity business model constraints"
    Add-IndentedText "Simple operational model may not justify complex AI solutions"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    # Key Insights
    Add-Heading "Key Insights & Recommendations" 1
    
    Add-Heading "Critical Observations" 2
    Add-IndentedText "FOMO-Driven AI Strategy: Bungie's AI initiatives appear driven by fear of missing out rather than clear business cases. Bob noted that executives are pursuing AI 'because everybody else is doing it.'"
    $selection.TypeParagraph()
    
    Add-IndentedText "Manufacturing Context Limitations: As Bob stated, 'We're not creating content.' Generative AI has limited direct application to Bungie's physical manufacturing operations (commodity procurement, transportation, processing)."
    $selection.TypeParagraph()
    
    Add-IndentedText "Organizational Risk: The combination of Business Intelligence/Analytics with Architecture is historically challenging. Bob expressed concern that 'it works if it works, but sometimes they don't.'"
    $selection.TypeParagraph()
    
    Add-IndentedText "Relationship Building Importance: Bob emphasized that 'building up your connections and the people you go to to help you get data to do your job' is critical, especially during organizational transitions."
    $selection.TypeParagraph()
    
    Add-Heading "Recommended Actions" 2
    Add-IndentedText "Immediate (This Week):"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Schedule Client Zero demo for June 8 or 9"
    Add-IndentedText "Include John in all communications"
    Add-IndentedText "Prepare manufacturing-specific use cases"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "Short-term (June):"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Deliver compelling Client Zero demonstration"
    Add-IndentedText "Build relationship with John"
    Add-IndentedText "Maintain flexible, educational posture"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "Medium-term (July-August):"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Reassess post-restructuring landscape"
    Add-IndentedText "Identify new decision-makers"
    Add-IndentedText "Develop targeted proposals"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    Add-IndentedText "Long-term (Q3-Q4 2026):"
    $selection.ParagraphFormat.LeftIndent = 72
    Add-IndentedText "Position for strategic advisory engagement"
    Add-IndentedText "Identify pilot project opportunities"
    Add-IndentedText "Engage with new organizational leaders"
    $selection.ParagraphFormat.LeftIndent = 0
    $selection.TypeParagraph()
    
    # Next Steps
    Add-Heading "Next Steps" 1
    Add-IndentedText "1. Dom/Russ: Schedule Client Zero demo for June 8 or 9"
    Add-IndentedText "2. Lauren: Prepare data governance and AI architecture discussion points"
    Add-IndentedText "3. Team: Develop manufacturing-specific Client Zero examples"
    Add-IndentedText "4. All: Include John in demo invitation and communications"
    Add-IndentedText "5. Follow-up: Check in with Bob end of June for organizational clarity"
    
    # Save document
    $doc.SaveAs([ref]$docxPath, [ref]16)
    
    # Close document and quit Word
    $doc.Close()
    $word.Quit()
    
    # Release COM objects
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($selection) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-Host "Successfully created formatted Word document: $docxPath"
}
catch {
    Write-Host "Error: $_"
    if ($word) {
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    exit 1
}

# Made with Bob
