# Azure DevOps Carry Over Extension

A Visual Studio Team Services (Azure DevOps) extension that transfers all unfinished work items from the previous sprint to the current one.

## Features

- **Automatic Sprint Detection**: Loads all available sprints and pre-selects the previous and current sprint
- **Smart Work Item Filtering**: Only transfers work items that are not in "Done", "Closed", or "Removed" states
- **Real-time Preview**: Shows all work items that will be transferred before execution
- **Detailed Logging**: Provides comprehensive feedback during the transfer process
- **Clean UI**: Modern interface integrated directly into Azure Boards

## Installation

1. Download the latest `.vsix` file from the [Releases](https://github.com/T3rr0rS0ck3/azure-devops-carrry-over-extension/releases) page
2. Go to your Azure DevOps organization
3. Navigate to **Organization Settings** → **Extensions** → **Browse marketplace**
4. Click **Manage extensions** → **Upload extension**
5. Upload the `.vsix` file

## Usage

1. Go to **Azure DevOps** → **Boards** → **Carry Over** tab
2. Select source sprint (previous sprint is pre-selected)
3. Select target sprint (current sprint is pre-selected)
4. Work items are automatically loaded when you select the source sprint
5. Review the list of work items to be transferred
6. Click **Transfer Open Items** to move all work items

## Development

### Prerequisites

- Node.js and npm
- TFX CLI: `npm install -g tfx-cli`

### Build

```bash
npm install
tfx extension create --manifest-globs vss-extension.json --rev-version
```

### Local Development

1. Clone the repository
2. Make your changes
3. Build the extension
4. Upload to your Azure DevOps organization for testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

If you encounter any issues or have feature requests, please create an issue on GitHub.
