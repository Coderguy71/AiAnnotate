# Contributing to PDF Annotation Service

Thank you for your interest in contributing to this project! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

Before contributing, ensure you have:
- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- Git
- A Groq API key (for testing AI features)

### Setup

1. Fork the repository
2. Clone your fork locally
3. Create a new branch for your feature or bugfix
4. Follow the setup instructions in the main README

## Development Workflow

### Branch Naming

- Use descriptive branch names: `feature/your-feature-name`, `bugfix/your-bugfix-name`, or `docs/your-docs-update`
- Use kebab-case for branch names

### Commit Messages

Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi colons, etc)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(api): add PDF annotation endpoint
fix(frontend): resolve upload button issue
docs(readme): update installation instructions
```

### Code Style

- Use ESLint and Prettier configurations provided
- Follow TypeScript best practices
- Write meaningful comments for complex logic
- Keep functions small and focused

## Testing

### Running Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write unit tests for new features
- Test edge cases and error conditions
- Aim for high code coverage
- Use descriptive test names

## Pull Request Process

1. **Update Documentation**: If your changes affect functionality, update the relevant documentation
2. **Test Thoroughly**: Ensure all tests pass and add new tests if needed
3. **Create Pull Request**: Provide a clear description of changes and why they're needed
4. **Code Review**: Respond to review feedback promptly
5. **Merge**: Once approved, your PR will be merged

### PR Template

When creating a pull request, include:
- Clear title and description
- Steps to test the changes
- Screenshots if applicable (for UI changes)
- Related issues (using `#issue-number` format)

## Areas for Contribution

We welcome contributions in several areas:

### Features
- New annotation types
- Enhanced AI analysis capabilities
- Improved user interface
- Additional export formats

### Bug Fixes
- Performance optimizations
- Security improvements
- Cross-browser compatibility
- Mobile responsiveness

### Documentation
- API documentation improvements
- Tutorial examples
- Translation support
- Troubleshooting guides

### Infrastructure
- CI/CD improvements
- Docker support
- Monitoring and logging
- Database optimizations

## Guidelines

### Security

- Never commit API keys or sensitive data
- Follow security best practices
- Report security vulnerabilities privately

### Performance

- Consider performance implications of changes
- Test with large PDF files
- Monitor memory usage
- Optimize database queries

### Accessibility

- Ensure UI changes are accessible
- Use semantic HTML
- Provide alt text for images
- Test with screen readers

## Getting Help

- Create an issue for questions or problems
- Join our community discussions
- Check existing issues before creating new ones
- Provide detailed information when reporting bugs

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉