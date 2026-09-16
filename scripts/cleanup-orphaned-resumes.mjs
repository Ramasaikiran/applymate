// One-off cleanup: finds every file in the "resumes" storage bucket
// that isn't referenced by any student_details.resume_url or
// professional_details.resume_url row, and deletes it.
//
// This is for files left behind BEFORE the resume-replace fix
// (commit 54dddc2) started cleaning up after itself. Safe to run
// more than once - it only ever touches genuinely unreferenced files.
//
// USAGE:
//   1. Dry run first (default) - lists what WOULD be deleted, deletes nothing:
//        SUPABASE_URL=https://ctfdkpizemhoccwtsvib.supabase.co \
//        SUPABASE_SERVICE_ROLE_KEY=<service role key, from Project Settings > API> \
//        node scripts/cleanup-orphaned-resumes.mjs
//
//   2. Once you've reviewed the dry-run output, actually delete:
//        SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//        node scripts/cleanup-orphaned-resumes.mjs --confirm
//
// Never commit the service role key anywhere - pass it as an env
// var on the command line each time, then close the terminal.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CONFIRM = process.argv.includes('--confirm')
const BUCKET = 'resumes'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function listAllUserFolders() {
  // Storage lists one directory level at a time. The bucket root
  // contains one "folder" per user id (paths are `${uid}/...`), so
  // list the root first to get every user folder, then list inside
  // each one.
  const folders = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: pageSize, offset })
    if (error) throw new Error(`Failed to list bucket root: ${error.message}`)
    if (!data || data.length === 0) break
    for (const entry of data) {
      // Folders show up with id === null in Supabase Storage's list()
      if (entry.id === null) folders.push(entry.name)
    }
    if (data.length < pageSize) break
    offset += pageSize
  }
  return folders
}

async function listFilesInFolder(folder) {
  const files = []
  let offset = 0
  const pageSize = 1000
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: pageSize, offset })
    if (error) throw new Error(`Failed to list folder ${folder}: ${error.message}`)
    if (!data || data.length === 0) break
    for (const entry of data) {
      if (entry.id !== null) files.push(`${folder}/${entry.name}`)
    }
    if (data.length < pageSize) break
    offset += pageSize
  }
  return files
}

async function getReferencedPaths() {
  const referenced = new Set()
  for (const table of ['student_details', 'professional_details']) {
    let from = 0
    const pageSize = 1000
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select('resume_url')
        .not('resume_url', 'is', null)
        .range(from, from + pageSize - 1)
      if (error) throw new Error(`Failed to read ${table}: ${error.message}`)
      if (!data || data.length === 0) break
      for (const row of data) referenced.add(row.resume_url)
      if (data.length < pageSize) break
      from += pageSize
    }
  }
  return referenced
}

async function main() {
  console.log(`Mode: ${CONFIRM ? 'DELETE (--confirm passed)' : 'DRY RUN (pass --confirm to actually delete)'}\n`)

  console.log('Reading referenced resume paths from the database...')
  const referenced = await getReferencedPaths()
  console.log(`  ${referenced.size} resume(s) currently referenced.\n`)

  console.log('Listing files in storage...')
  const folders = await listAllUserFolders()
  let allFiles = []
  for (const folder of folders) {
    const files = await listFilesInFolder(folder)
    allFiles = allFiles.concat(files)
  }
  console.log(`  ${allFiles.length} file(s) found in the "${BUCKET}" bucket across ${folders.length} user folder(s).\n`)

  const orphaned = allFiles.filter(path => !referenced.has(path))

  console.log(`Orphaned files (not referenced by any profile): ${orphaned.length}`)
  for (const path of orphaned) console.log(`  - ${path}`)

  if (orphaned.length === 0) {
    console.log('\nNothing to clean up.')
    return
  }

  if (!CONFIRM) {
    console.log('\nDry run only - nothing deleted. Re-run with --confirm to delete the files listed above.')
    return
  }

  console.log('\nDeleting...')
  // Storage remove() accepts up to ~1000 paths per call; batch to be safe.
  const batchSize = 500
  let deletedCount = 0
  for (let i = 0; i < orphaned.length; i += batchSize) {
    const batch = orphaned.slice(i, i + batchSize)
    const { data, error } = await supabase.storage.from(BUCKET).remove(batch)
    if (error) {
      console.error(`  Batch starting at ${i} failed: ${error.message}`)
      continue
    }
    deletedCount += data?.length ?? batch.length
  }
  console.log(`\nDone. Deleted ${deletedCount} of ${orphaned.length} orphaned file(s).`)
}

main().catch(err => {
  console.error('Cleanup failed:', err.message)
  process.exit(1)
})
