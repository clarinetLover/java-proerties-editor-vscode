# Properties File Unicode Extension

A VS Code extension that automatically handles Unicode encoding/decoding for Java properties files.

## Features

- **Auto-encode on save**: Converts multibyte characters to `\u` format when saving `.properties` files
- **Auto-decode on open**: Converts `\u` encoded characters back to readable text when opening files
- **Smart save detection**: Only saves when actual content changes are made
- **Syntax highlighting**: Provides proper syntax highlighting for Java properties files
- **Seamless editing**: Always displays readable characters in the editor while maintaining file compatibility

## Usage

1. Open any `.properties` file
2. Edit with readable Unicode characters (Japanese, Chinese, Korean, etc.)
3. Save the file - characters automatically encode to `\u` format
4. Editor continues to show readable characters for easy editing

## Example

**What you type:**
```properties
app.name=こんにちは
message=世界
```

**What gets saved to file:**
```properties
app.name=\u3053\u3093\u306b\u3061\u306f
message=\u4e16\u754c
```

**What you see in editor:**
```properties
app.name=こんにちは
message=世界
```

## Installation

Install from VS Code Extensions or package manually with `vsce package`.

## License

MIT License