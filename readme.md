# C2PA API

A simple and robust API for implementing Content Credentials (C2PA) in your projects without dealing with the underlying infrastructure.

## Overview

This C2PA API provides a streamlined interface for creating, updating, and validating Content Credentials (C2PA) manifests. It abstracts the complex implementation details of the C2PA standard, allowing developers to easily add content provenance capabilities to their applications.

## What is C2PA?

The Coalition for Content Provenance and Authenticity (C2PA) is an open technical standard that provides publishers, creators, and consumers with opt-in tools to create and trace the origin and evolution of digital content.

## Features

- **Create C2PA Manifests**: Generate signed manifests for images and other media files
- **Update Existing Manifests**: Add ingredients and track edits to content
- **Validate Manifests**: Verify the authenticity and integrity of content by ID or file
- **Simple REST API**: Easy-to-use endpoints with comprehensive JSON responses
- **Swagger Documentation**: Interactive API documentation included

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/khellwan/c2pa-api.git
cd c2pa-api
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file (for local signing configuration)
```
PORT=3000
PUBLIC_KEY=path/to/your/certificate.crt
PRIVATE_KEY=path/to/your/private.key
```

4. Start the server
```bash
npm start
```

The server will run on `http://localhost:3000` by default, with Swagger documentation available at `http://localhost:3000/api-docs`.

## API Endpoints

### Create a C2PA Manifest

```
POST /manifests
```

Create a new C2PA manifest from base64-encoded file data.

**Request Body:**
```json
{
  "fileData": "base64EncodedString",
  "contentCredentials": {
    "format": "image/jpeg",
    "title": "My Image",
    "authors": ["Jane Doe"]
  }
}
```

**Response:**
```
201 Created
"manifestId"
```

### Update a Manifest

```
POST /manifests/update
```

Update an existing manifest by adding an ingredient.

**Request Body:**
```json
{
  "fileData": "base64EncodedString",
  "contentCredentials": {
    "format": "image/jpeg",
    "title": "Updated Image",
    "authors": ["Jane Doe"],
    "action": "c2pa.edited"
  }
}
```

**Response:**
```
200 OK
"updatedManifestId"
```

### Validate a Manifest by ID

```
GET /manifests/{manifestId}/validate
```

Validate a manifest using its ID.

**Response:**
```json
{
  "manifest": {...},
  "contentCredentials": {...},
  "filePath": "/uploads/uuid.jpg",
  "signed": true
}
```

### Validate a Manifest by File

```
POST /manifests/validate
```

Validate a manifest using base64-encoded file data.

**Request Body:**
```json
{
  "fileData": "base64EncodedString",
  "format": "image/jpeg"
}
```

**Response:**
```json
{
  "isValid": true,
  "message": {...}
}
```

## Use Cases

- **Content Publishing Platforms**: Verify the source and edit history of uploaded content
- **Media Organizations**: Add provenance data to published content
- **Creative Applications**: Track editing history and maintain attribution through workflows
- **Verification Systems**: Authenticate content and detect potential manipulations

## Architecture

The API follows a simple MVC architecture:
- **Controllers**: Handle HTTP requests/responses
- **Services**: Implement business logic for C2PA operations
- **Routes**: Define API endpoints

Files are temporarily stored in the `/uploads` directory.
## Current Limitations

- Uses a test signer by default (TODO: configure a production signer)
- Local file storage (TODO: replace with cloud storage)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.

## Acknowledgments

- [C2PA](https://c2pa.org/) - For developing the Content Credentials standard
- [Content Authenticity Initiative](https://contentauthenticity.org/) - For promoting the adoption of content credentials