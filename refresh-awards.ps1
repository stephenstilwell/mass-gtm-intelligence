param(
    [string]$StartDate = '2024-01-01',
    [string]$EndDate = (Get-Date -Format 'yyyy-MM-dd'),
    [string]$OutFile = (Join-Path $PSScriptRoot 'award-candidates.json')
)

$ErrorActionPreference = 'Stop'
$endpoint = 'https://api.usaspending.gov/api/v2/search/spending_by_award/'
$recipients = [ordered]@{
    standardaero = @('STANDARD AERO (SAN ANTONIO)', 'STANDARDAERO')
    aar = @('AAR GOVERNMENT SERVICES', 'AAR AIRCRAFT SERVICES')
    ati = @('ATI SPECIALTY', 'ALLEGHENY TECHNOLOGIES')
    carpenter = @('CARPENTER TECHNOLOGY', 'CARPENTER ADDITIVE')
    howmet = @('HOWMET', 'CONSOLIDATED AEROSPACE MANUFACTURING')
    curtiss = @('CURTISS-WRIGHT', 'CURTISS WRIGHT')
    moog = @('MOOG INC', 'MOOG AIRCRAFT')
    ducommun = @('DUCOMMUN')
    astronics = @('ASTRONICS')
    oshkosh = @('OSHKOSH DEFENSE', 'OSHKOSH CORPORATION')
    woodward = @('WOODWARD INC', 'WOODWARD FST')
    hexcel = @('HEXCEL')
    triumph = @('TRIUMPH GROUP', 'TRIUMPH AEROSTRUCTURES', 'TRIUMPH ACTUATION')
    kaman = @('KAMAN AEROSPACE', 'KAMAN PRECISION')
}

$snapshots = foreach ($recipient in $recipients.GetEnumerator()) {
    $body = @{
        filters = @{
            award_type_codes = @('A', 'B', 'C', 'D')
            time_period = @(@{ start_date = $StartDate; end_date = $EndDate })
            agencies = @(@{ type = 'awarding'; tier = 'toptier'; name = 'Department of Defense' })
            recipient_search_text = $recipient.Value
        }
        fields = @('Award ID', 'Recipient Name', 'Start Date', 'End Date', 'Award Amount', 'Awarding Sub Agency', 'Description')
        sort = 'Award Amount'
        order = 'desc'
        limit = 12
        page = 1
    } | ConvertTo-Json -Depth 6 -Compress

    try {
        $response = Invoke-RestMethod -Uri $endpoint -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 30
        [pscustomobject]@{ account = $recipient.Key; rows = @($response.results); error = $null }
    } catch {
        [pscustomobject]@{ account = $recipient.Key; rows = @(); error = $_.Exception.Message }
    }
}

$snapshot = [pscustomobject]@{
    endpoint = $endpoint
    startDate = $StartDate
    endDate = $EndDate
    accounts = @($snapshots)
}
$snapshot | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutFile -Encoding UTF8
$snapshots | Select-Object account, @{Name = 'rows'; Expression = { $_.rows.Count }}, error | Format-Table
