# PowerShell script to convert Bob Jett Meeting Markdown to Word document
$mdPath = "C:\Users\RussConner\OneDrive - IBM\Documents\.git\.meetings\2026_05_26\Bob Jett Meeting - Technical Summary.md"
$docxPath = "C:\Users\RussConner\OneDrive - IBM\Documents\.git\.meetings\2026_05_26\Bob Jett Meeting - Technical Summary.docx"

try {
    # Create Word application object
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    
    # Create new document
    $doc = $word.Documents.Add()
    
    # Read markdown content
    $content = Get-Content $mdPath -Raw
    
    # Insert content into document
    $doc.Content.Text = $content
    
    # Save as Word document
    $doc.SaveAs([ref]$docxPath, [ref]16)
    
    # Close document and quit Word
    $doc.Close()
    $word.Quit()
    
    # Release COM objects
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($doc) | Out-Null
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
    
    Write-Host "Successfully converted Bob Jett meeting summary to Word document: $docxPath"
}
catch {
    Write-Host "Error: $_"
    exit 1
}

# Made with Bob
