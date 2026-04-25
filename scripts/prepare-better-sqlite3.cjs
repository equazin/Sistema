const { existsSync } = require('node:fs')
const { join } = require('node:path')
const { spawnSync } = require('node:child_process')

const runtime = process.argv[2]
const rootDir = join(__dirname, '..')
const packageDir = join(rootDir, 'node_modules', 'better-sqlite3')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

if (runtime !== 'node' && runtime !== 'electron') {
  console.error('Usage: node scripts/prepare-better-sqlite3.cjs <node|electron>')
  process.exit(1)
}

if (!existsSync(packageDir)) {
  console.error('better-sqlite3 is not installed. Run npm install first.')
  process.exit(1)
}

if (runtime === 'node' && canLoadInNode()) {
  console.log('better-sqlite3 is already ready for Node.')
  process.exit(0)
}

const args = [
  'prebuild-install',
  '--runtime',
  runtime,
  '--arch',
  process.arch,
  '--platform',
  process.platform,
  '--force',
]

if (runtime === 'electron') {
  args.push('--target', getElectronVersion())
}

const install = run(npx, args)
if (install.status === 0) {
  if (runtime === 'node' && !canLoadInNode()) {
    console.error('better-sqlite3 prebuild installed, but Node still cannot load it.')
    process.exit(1)
  }
  process.exit(0)
}

if (runtime === 'electron') {
  const rebuild = run(npx, ['electron-rebuild', '-f', '-w', 'better-sqlite3'])
  process.exit(rebuild.status ?? 1)
}

const rebuild = run(npx, ['node-gyp', 'rebuild', '--release'])
if (rebuild.status === 0 && canLoadInNode()) {
  process.exit(0)
}
process.exit(rebuild.status ?? 1)

function run(command, args) {
  console.log(`Preparing better-sqlite3 for ${runtime}: ${command} ${args.join(' ')}`)
  return spawnSync(command, args, {
    cwd: packageDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
}

function canLoadInNode() {
  const check = spawnSync(
    process.execPath,
    ['-e', "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.close();"],
    {
      cwd: rootDir,
      stdio: 'ignore',
      shell: false,
    }
  )
  return check.status === 0
}

function getElectronVersion() {
  try {
    return require(join(rootDir, 'node_modules', 'electron', 'package.json')).version
  } catch {
    const pkg = require(join(rootDir, 'package.json'))
    return String(pkg.devDependencies.electron).replace(/^[^\d]*/, '')
  }
}
