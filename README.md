# PR Status checker
This tool checks student pull request status using the GitHub REST API.

## Configuration
This application uses environment variables and a `config.json` file for configuration.

Below is a sample `config.json` file:
```
{
	"githubAuthors": [
		"ace-n"
	],
	"githubOrg": "Ada-C11",
	"cacheExpiry": "60 minutes",
	"allGithubRepos": [
		"Restricted-Arrays-Part1",
		"array_equals",
		"factorial",
		"integer_palindrome_check",
		"palindrome_check",
		"reverse_sentence",
		"reverse_words",
		"string_reverse",
		"fibonacci",
		"array_intersection"
	]
}
```

GitHub requests are cached in the `cache/` directory. (This directory will automatically be created if it doesn't exist.)

### Settings
`githubAuthors`: a list of students to check for pull requests from
`githubOrg`: the GitHub user or organization the pull requests are made to
`allGithubRepos`: a complete list of GitHub repos to check 
`cacheExpiry`: how long cached GitHub requests are valid for

## Usage
```
prcheck <command>

Commands:
  prcheck check <repos...>  Checks for PR status

Options:
  --version  Show version number                                                           [boolean]
  --help     Show help                                                                     [boolean]

Examples:
  prcheck check repo_1 repo_2                          Search for PRs from repo_1 and repo_2.
                                                       Filter authors based on config.json
                                                       (default: no filter)
  prcheck check repo_1 repo_2 --authors user_1 user_2  Search for PRs from repo_1 and repo_2 with
                                                       authors user_1 and user_2
  prcheck check @ --authors user_1 user_2              Search for PRs from any repo with authors
                                                       user_1 and user_2
  prcheck check @ --authors @                          Search for PRs from all repos authored by
                                                       anyone
```

## License
Licensed under the Apache 2.0 license.
