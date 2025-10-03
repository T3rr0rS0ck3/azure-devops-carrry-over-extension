# TypeScript Development Setup

This project now uses TypeScript for better type safety and development experience.

## Development Workflow

### Prerequisites
```bash
npm install
```

### Build Commands

**Compile TypeScript:**
```bash
npm run compile
```

**Watch Mode (Auto-compile on changes):**
```bash
npm run watch
```

**Build Extension Package:**
```bash
npm run build
```

**Legacy JavaScript Build:**
```bash
npm run build-js
```

## File Structure

- `content/carryover.ts` - TypeScript source code
- `content/carryover.js` - Compiled JavaScript (auto-generated)
- `tsconfig.json` - TypeScript configuration
- `package.json` - Build scripts and dependencies

## TypeScript Features Added

- **Strong Typing:** Interfaces for Azure DevOps objects (Sprint, WorkItem, etc.)
- **Type Safety:** Proper typing for DOM elements and VSS SDK
- **IntelliSense:** Better IDE support with auto-completion
- **Error Prevention:** Compile-time type checking
- **Null Safety:** Proper null/undefined checks

## Development Notes

1. Edit only the `.ts` file, never the compiled `.js` file
2. Run `npm run compile` or `npm run watch` after TypeScript changes
3. The HTML still references the `.js` file (compiled output)
4. Extension packaging automatically compiles TypeScript first

## Type Definitions

The project includes custom type definitions for:
- VSS SDK interfaces
- Azure DevOps REST API objects
- DOM element types with proper casting