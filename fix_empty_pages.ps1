# Fix empty React page components
$emptyFiles = Get-ChildItem -Path "property-search-frontend/src" -Filter "*.tsx" -Recurse | Where-Object { $_.Length -eq 0 }

foreach ($file in $emptyFiles) {
  $pageName = $file.BaseName
  $componentName = $pageName.Substring(0, 1).ToUpper() + $pageName.Substring(1) + "Page"
    
  $content = @"
export default function $componentName() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">$pageName</h1>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-gray-600">This page will be implemented.</p>
      </div>
    </div>
  )
}
"@
    
  Set-Content -Path $file.FullName -Value $content
  Write-Host "Fixed: $($file.FullName)"
}