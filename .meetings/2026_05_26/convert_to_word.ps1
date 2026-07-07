# PowerShell script to convert Markdown to Word document with proper formatting
$mdPath = "C:\Users\RussConner\OneDrive - IBM\Documents\.git\.meetings\2026_05_26\Meeting Summary - Technical Analysis.md"
$docxPath = "C:\Users\RussConner\OneDrive - IBM\Documents\.git\.meetings\2026_05_26\Meeting Summary - Technical Analysis.docx"

try {
    # Create Word application object
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    
    # Create new document
    $doc = $word.Documents.Add()
    $selection = $word.Selection
    
    # Read markdown content
    $lines = Get-Content $mdPath
    
    # Set default font
    $doc.Content.Font.Name = "Calibri"
    $doc.Content.Font.Size = 11
    
    foreach ($line in $lines) {
        if ($line -match '^# (.+)$') {
            # Heading 1
            $selection.Style = "Heading 1"
            $selection.TypeText($matches[1])
            $selection.TypeParagraph()
        }
        elseif ($line -match '^## (.+)$') {
            # Heading 2
            $selection.Style = "Heading 2"
            $selection.TypeText($matches[1])
            $selection.TypeParagraph()
        }
        elseif ($line -match '^### (.+)$') {
            # Heading 3
            $selection.Style = "Heading 3"
            $selection.TypeText($matches[1])
            $selection.TypeParagraph()
        }
        elseif ($line -match '^---+$') {
            # Horizontal rule - insert a line
            $selection.Style = "Normal"
            $selection.TypeParagraph()
        }
        elseif ($line -match '^\*\*(.+?)\*\*:?\s*(.*)$') {
            # Bold text (often used for labels)
            $selection.Style = "Normal"
            $selection.Font.Bold = $true
            $selection.TypeText($matches[1])
            $selection.Font.Bold = $false
            if ($matches[2]) {
                $selection.TypeText(": " + $matches[2])
            }
            $selection.TypeParagraph()
        }
        elseif ($line -match '^\s*-\s+\*\*(.+?)\*\*:?\s*(.*)$') {
            # Bullet with bold text
            $selection.Style = "List Bullet"
            $selection.Font.Bold = $true
            $selection.TypeText($matches[1])
            $selection.Font.Bold = $false
            if ($matches[2]) {
                $selection.TypeText(": " + $matches[2])
            }
            $selection.TypeParagraph()
        }
        elseif ($line -match '^\s*-\s+(.+)$') {
            # Regular bullet point
            $selection.Style = "List Bullet"
            $selection.TypeText($matches[1])
            $selection.TypeParagraph()
        }
        elseif ($line -match '^\s+\*\s+(.+)$') {
            # Sub-bullet (indented)
            $selection.Style = "List Bullet 2"
            $selection.TypeText($matches[1])
            $selection.TypeParagraph()
        }
        elseif ($line -match '^\d+\.\s+(.+)$') {
            # Numbered list
            $selection.Style = "List Number"
            $selection.TypeText($matches[1])
            $selection.TypeParagraph()
        }
        elseif ($line.Trim() -eq '') {
            # Empty line
            $selection.Style = "Normal"
            $selection.TypeParagraph()
        }
        else {
            # Regular text
            $selection.Style = "Normal"
            # Handle inline bold
            $text = $line
            while ($text -match '\*\*(.+?)\*\*') {
                $before = $text.Substring(0, $matches.Index)
                $bold = $matches[1]
                $after = $text.Substring($matches.Index + $matches[0].Length)
                
                if ($before) { $selection.TypeText($before) }
                $selection.Font.Bold = $true
                $selection.TypeText($bold)
                $selection.Font.Bold = $false
                
                $text = $after
            }
            if ($text) { $selection.TypeText($text) }
            $selection.TypeParagraph()
        }
    }
    
    # Format the document
    $doc.Content.ParagraphFormat.SpaceAfter = 6
    $doc.Content.ParagraphFormat.LineSpacingRule = 0  # Single spacing
    
    # Set page margins (1 inch all around)
    $doc.PageSetup.TopMargin = 72
    $doc.PageSetup.BottomMargin = 72
    $doc.PageSetup.LeftMargin = 72
    $doc.PageSetup.RightMargin = 72
    
    # Save as Word document
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
    
    Write-Host "Successfully converted to Word document with formatting: $docxPath"
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
