// Block critical CLAUDE.md violations in Write/Edit operations
// Exit code 1 = BLOCK the operation (non-zero = rejection)
// Exit code 0 = ALLOW the operation

const fs = require('fs');

let data = '';
process.stdin.on('data', chunk => data += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const content = input.tool_input?.content || input.tool_input?.new_string || '';
    const filePath = input.tool_input?.file_path || '';

    // Only check code files
    if (!/\.(ts|tsx|js|jsx|py|go|java)$/.test(filePath)) {
      process.stdout.write(data);
      return;
    }

    const violations = [];

    // Rule 3: No hardcoded secrets
    const secretPatterns = [
      /['"]sk[-_][a-zA-Z0-9]{20,}['"]/,       // Stripe/OpenAI keys
      /['"]shpat_[a-zA-Z0-9]{20,}['"]/,        // Shopify tokens
      /['"]sbp_[a-zA-Z0-9]{20,}['"]/,          // Supabase tokens
      /['"]pk_[a-zA-Z0-9]{20,}['"]/,           // Publishable keys
      /['"]ghp_[a-zA-Z0-9]{20,}['"]/,          // GitHub PATs
      /password\s*[:=]\s*['"][^'"]{8,}['"]/i,   // Hardcoded passwords
      /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i, // API keys
    ];

    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        violations.push('BLOCKED: Hardcoded secret detected! Use environment variables.');
        break;
      }
    }

    // Rule 8: No console.log in production code
    // Only block if writing NEW console.logs (not in test files)
    if (!/\.(test|spec|__test__)/.test(filePath)) {
      const lines = content.split('\n');
      const consoleLines = lines.filter(l => /console\.log\(/.test(l) && !/\/\//.test(l.split('console.log')[0]));
      if (consoleLines.length > 0) {
        violations.push(`WARNING: ${consoleLines.length} console.log statement(s) found. Remove before commit.`);
        // Warning only, don't block
      }
    }

    if (violations.some(v => v.startsWith('BLOCKED'))) {
      // Output violations to stderr and exit with non-zero to block
      violations.forEach(v => process.stderr.write('[VIOLATION] ' + v + '\n'));
      process.exit(1);
    }

    // Warnings go to stderr but don't block
    violations.forEach(v => process.stderr.write('[VIOLATION] ' + v + '\n'));

    // Allow the operation
    process.stdout.write(data);
  } catch (e) {
    // On error, allow the operation (fail open)
    process.stdout.write(data);
  }
});
