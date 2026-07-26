# Apple Watch Sleep Import with iOS Shortcuts

This guide creates an iPhone Shortcut that reads the previous night's sleep
start time from Apple Health and appends it to `state.todo.jsonl` in the private
data repository.

The next time the website connects or refreshes, it:

1. Reads every pending JSONL line.
2. Converts each line into a normal sleep record.
3. Updates `state.json`.
4. Clears `state.todo.jsonl`.

The Shortcut sends only these three fields:

```json
{"sleepDate":"2026-07-21","sleepTime":"00:43","source":"apple-watch"}
```

The website remains responsible for calculating points, late-night resets,
streaks, and rescue-card behavior. Duplicate imports are acceptable because the
newest record for a date overrides older records.

Action names can differ slightly between iOS versions and display languages.

## 1. Prepare the private data repository

The Shortcut writes to the same private repository that stores `state.json`.

1. Open the private data repository on GitHub.
2. Create a root-level file named `state.todo.jsonl`.
3. Leave the file empty except for a blank line or a single space.
4. Commit the file to the branch used by the website, normally `main`.
5. Confirm that [`config.js`](./config.js) contains:

   ```js
   TODO_PATH: "state.todo.jsonl",
   ```

The file must already exist because the Shortcut below updates it using its
current Git blob SHA. The website also keeps the file in place when it clears
the inbox.

## 2. Create a GitHub token

Create a fine-grained personal access token:

1. Open GitHub **Settings**.
2. Open **Developer settings**.
3. Open **Personal access tokens** and then **Fine-grained tokens**.
4. Create a new token.
5. Set **Repository access** to only the private data repository.
6. Under **Repository permissions**, grant **Contents: Read and write**.
7. Choose a reasonable expiration date.
8. Generate the token and keep it available while building the Shortcut.

The token will be stored in a `Text` action inside the Shortcut. Anyone who can
edit or export that Shortcut can see the token. Do not share the Shortcut while
the token is present. If it is exposed, revoke it on GitHub and create a new
one.

## 3. Create the Shortcut and constants

1. Open **Shortcuts** on the iPhone.
2. Tap **+** to create a shortcut.
3. Name it `Upload Apple Watch Sleep`.
4. Add a `Text` action containing the GitHub account or organization name that
   owns the private data repository.
5. Add a `Set Variable` action and name the variable `Owner`.
6. Add another `Text` action containing only the repository name, without
   `.git`.
7. Add `Set Variable` and name it `Repo`.
8. Add a `Text` action containing the branch name, normally `main`.
9. Add `Set Variable` and name it `Branch`.
10. Add a `Text` action containing:

    ```text
    state.todo.jsonl
    ```

11. Add `Set Variable` and name it `TodoPath`.
12. Add a `Text` action containing the fine-grained GitHub token.
13. Add `Set Variable` and name it `GitHubToken`.

At this point the beginning of the Shortcut should define:

| Variable | Example |
| --- | --- |
| `Owner` | `your-github-name` |
| `Repo` | `sleep-points-data` |
| `Branch` | `main` |
| `TodoPath` | `state.todo.jsonl` |
| `GitHubToken` | `github_pat_...` |

## 4. Find the previous night's sleep start

Apple Health stores a night as several sleep-stage samples, such as Core, Deep,
and REM. The goal is to find the earliest real sleep-stage sample, not an
`In Bed` or `Awake` sample.

1. Add `Current Date`.
2. Add `Adjust Date`.
3. Configure it to subtract `18` hours from `Current Date`.
4. Add `Set Variable` and name the adjusted result `SearchStart`.
5. Add `Find Health Samples`.
6. Set the health type to `Sleep` or `Sleep Analysis`.
7. Add a filter where `Start Date` is after `SearchStart`.
8. Exclude samples whose value is `In Bed`.
9. Exclude samples whose value is `Awake`.
10. If the phone has sleep data from multiple sources, add a source filter for
    the Apple Watch.
11. Sort by `Start Date`.
12. Set the sort order to oldest first.

On versions of iOS that do not offer value exclusions directly in `Find Health
Samples`, retrieve the samples first and use `Filter Files` or a `Repeat with
Each` block to retain Core, Deep, REM, or Asleep samples.

For the first setup run, add a temporary `Quick Look` action after `Find Health
Samples`. Run the Shortcut and confirm that:

- At least one sample is returned.
- The first sample belongs to the previous night's actual sleep.
- `In Bed` and `Awake` entries are not first.

Remove the temporary `Quick Look` after verifying the result.

### Handle a missing sample

1. Add `Count` after `Find Health Samples`.
2. Add an `If` action: if `Count` is `0`.
3. Inside the `If` block, add `Show Notification` with:

   ```text
   No Apple Watch sleep sample was found.
   ```

4. Add `Stop This Shortcut`.
5. End the `If` block.

This prevents an empty or malformed record from reaching GitHub.

### Select the earliest sample

1. Add `Get Item from List`.
2. Set it to get the `First Item` from the Health Samples result.
3. Add `Get Details of Health Sample`.
4. Select `Start Date`.
5. Add `Set Variable` and name it `SleepStart`.

The first run may ask for permission to read Sleep data from Health. Allow the
permission. It can later be reviewed under iPhone **Settings > Privacy &
Security > Health > Shortcuts**.

## 5. Convert the Health date to the app's format

The app treats a bedtime after midnight as belonging to the preceding night.
For example, `2026-07-22 00:43` becomes:

```json
{"sleepDate":"2026-07-21","sleepTime":"00:43","source":"apple-watch"}
```

### Create `SleepTime`

1. Add `Format Date`.
2. Use `SleepStart` as its input.
3. Choose the custom date format:

   ```text
   HH:mm
   ```

4. Add `Set Variable` and name it `SleepTime`.

Use capital `HH` so the output is a zero-padded 24-hour time such as `00:43`.

### Determine the night date

1. Add another `Format Date`.
2. Use `SleepStart` as its input.
3. Choose the custom format:

   ```text
   H
   ```

4. Add `Set Variable` and name it `SleepHour`.
5. Add an `If` action: if `SleepHour` is less than `12`.
6. Inside the `If` block, add `Adjust Date`.
7. Subtract `1` day from `SleepStart`.
8. Add `Set Variable` and name it `SleepNightDate`.
9. In the `Otherwise` block, add `Set Variable`, set its value to
   `SleepStart`, and also name it `SleepNightDate`.
10. End the `If` block.

This rule maps sleep starting between midnight and 11:59 AM to the preceding
calendar date. Sleep starting at noon or later keeps its calendar date.

### Create `SleepDate`

1. Add `Format Date`.
2. Use `SleepNightDate` as its input.
3. Choose the custom format:

   ```text
   yyyy-MM-dd
   ```

4. Add `Set Variable` and name it `SleepDate`.

## 6. Build one JSONL record

Add a `Text` action with the following content. Insert `SleepDate` and
`SleepTime` as Shortcut variables; do not type their names as plain text.

```text
{"sleepDate":"[SleepDate]","sleepTime":"[SleepTime]","source":"apple-watch"}
```

The square brackets above indicate Magic Variables in the Shortcuts editor.
They must not appear in the final generated text.

Add `Set Variable` after the `Text` action and name it `NewTodoLine`.

The generated record must remain on one line. JSONL means one complete JSON
object per line, not a JSON array and not pretty-printed JSON.

## 7. Build the GitHub Contents API URLs

Add a `Text` action containing the following URL. Insert the four variables
from section 3:

```text
https://api.github.com/repos/[Owner]/[Repo]/contents/[TodoPath]
```

Add `Set Variable` and name it `TodoUrl`.

Add another `Text` action:

```text
[TodoUrl]?ref=[Branch]
```

Add `Set Variable` and name it `TodoReadUrl`.

For the normal values `main` and `state.todo.jsonl`, no additional URL encoding
is needed.

## 8. Download the current inbox

1. Add `Get Contents of URL`.
2. Set the URL to `TodoReadUrl`.
3. Expand the action with **Show More**.
4. Set the method to `GET`.
5. Add these request headers:

   | Header | Value |
   | --- | --- |
   | `Accept` | `application/vnd.github+json` |
   | `Authorization` | `Bearer [GitHubToken]` |
   | `X-GitHub-Api-Version` | `2022-11-28` |

   Insert `GitHubToken` as a Magic Variable after the text `Bearer `.

6. Add `Set Variable` after the request and name the response
   `GitHubFileResponse`.
7. Add `Get Dictionary Value`.
8. Get the value for the key `content` from `GitHubFileResponse`.
9. Add `Set Variable` and name it `EncodedOldContent`.
10. Add another `Get Dictionary Value`.
11. Get the value for the key `sha` from `GitHubFileResponse`.
12. Add `Set Variable` and name it `TodoSha`.

GitHub returns the existing file content as Base64 and returns its current blob
SHA. The SHA is required to update an existing file without blindly
overwriting a newer version.

### Decode the existing content

GitHub may insert line breaks into the Base64 response. The iOS decoder normally
accepts them. If decoding fails, add `Replace Text` before the decoder, enable
regular expressions, replace `\s` with nothing, and use that cleaned result.

1. Add `Base64 Encode`.
2. Tap `Encode` in the action and change it to `Decode`.
3. Use `EncodedOldContent` as the input.
4. If the decoded result is treated as a file, add `Get Text from Input`.
5. Add `Set Variable` and name the result `OldTodoText`.

## 9. Append the new line

Add a `Text` action containing the following two Magic Variables on separate
lines:

```text
[OldTodoText]
[NewTodoLine]
```

It is fine if this creates an extra blank line. The website ignores blank lines.

1. Add `Set Variable` and name this text `NewTodoText`.
2. Add `Base64 Encode`.
3. Keep the mode set to `Encode`.
4. Use `NewTodoText` as the input.
5. Set line breaks to `None` if that option is shown.
6. Add `Set Variable` and name the result `EncodedNewContent`.

## 10. Upload the updated inbox

1. Add another `Get Contents of URL`.
2. Set the URL to `TodoUrl`, without the `?ref=` query.
3. Expand the action with **Show More**.
4. Set the method to `PUT`.
5. Add these headers:

   | Header | Value |
   | --- | --- |
   | `Accept` | `application/vnd.github+json` |
   | `Authorization` | `Bearer [GitHubToken]` |
   | `X-GitHub-Api-Version` | `2022-11-28` |
   | `Content-Type` | `application/json` |

6. Set **Request Body** to `JSON`.
7. Add these JSON fields:

   | Key | Type | Value |
   | --- | --- | --- |
   | `message` | Text | `queue Apple Watch sleep` |
   | `content` | Text | `EncodedNewContent` |
   | `sha` | Text | `TodoSha` |
   | `branch` | Text | `Branch` |

Make sure `EncodedNewContent`, `TodoSha`, and `Branch` are inserted as Magic
Variables.

8. Add `Show Notification` after the request:

   ```text
   Apple Watch sleep queued: [SleepDate] at [SleepTime]
   ```

The final request replaces the inbox with its previous text plus the new JSONL
line. GitHub creates a commit in the private data repository.

## 11. Test the complete flow

Run the Shortcut manually before creating an automation:

1. Open the Health app and confirm that the previous night contains sleep-stage
   data.
2. Run `Upload Apple Watch Sleep`.
3. Approve Health and network permissions if prompted.
4. Open `state.todo.jsonl` in the private data repository.
5. Confirm that it contains a line resembling:

   ```json
   {"sleepDate":"2026-07-21","sleepTime":"00:43","source":"apple-watch"}
   ```

6. Open the sleep website and connect to the private data repository.
7. Refresh the website if it was already open.
8. Confirm that the sleep record appears on the expected night.
9. Reopen `state.todo.jsonl` on GitHub and confirm that the website cleared it.

If the date is one day too early or late, inspect `SleepStart`, `SleepHour`, and
`SleepNightDate` with temporary `Quick Look` actions before changing the date
rule.

## 12. Run it automatically

A time-based automation is usually the most reliable choice because it gives
Apple Watch time to sync the completed sleep session to the iPhone.

1. In Shortcuts, open the **Automation** tab.
2. Tap **+** and create a personal automation.
3. Select **Time of Day**.
4. Choose a time after the Watch normally finishes syncing, such as `9:00 AM`.
5. Set it to repeat daily.
6. Choose `Run Immediately` if that option is available.
7. Add the `Run Shortcut` action.
8. Select `Upload Apple Watch Sleep`.
9. Save the automation.

Alternatively, use the Sleep `Waking Up` trigger. If that trigger runs before
Health has received the sleep stages, use a later time-based automation instead.

Keep the success notification enabled for the first several days. It can be
removed once the automation has proven reliable.

## Troubleshooting

### `401 Bad credentials`

- Confirm that the Authorization header starts with `Bearer ` followed by the
  token variable.
- Check whether the token has expired or been revoked.

### `403 Forbidden`

- Confirm that the fine-grained token can access the private data repository.
- Confirm that **Contents** permission is set to **Read and write**.

### `404 Not Found`

- Check `Owner`, `Repo`, `TodoPath`, and `Branch` for spelling and capitalization.
- Confirm that `state.todo.jsonl` already exists in the private data repository.
- A private repository can also return `404` when the token cannot access it.

### `409 Conflict`

The inbox changed between the Shortcut's `GET` and `PUT`, usually because the
website cleared it or another Shortcut run updated it. Run the Shortcut again.
It will fetch the newest SHA before retrying.

A clear conflict after the website has imported the record can leave the same
line in the inbox. Importing it again is acceptable in this app because the
newest sleep record for that date overrides the older one.

### Base64 decoding fails

Remove whitespace from `EncodedOldContent` before decoding:

1. Add `Replace Text`.
2. Enable regular expressions.
3. Find `\s`.
4. Replace it with an empty value.
5. Decode the cleaned result.

### No sleep sample is found

- Open Health and wait for Apple Watch sleep data to finish syncing.
- Increase the search window from `18` hours to `24` hours.
- Temporarily remove the source filter.
- Use `Quick Look` to inspect which values the local iOS version returns.
- Confirm that Shortcuts has permission to read Sleep data.

### The wrong sleep time is selected

- Confirm that the samples are sorted by `Start Date`, oldest first.
- Exclude `In Bed` and `Awake`.
- If Health contains manually entered data, add an Apple Watch source filter.
- Inspect the first sample with `Quick Look`.

## References

- [Apple: Find Health Samples supports sleep phases](https://support.apple.com/en-mide/101583)
- [Apple: Make API requests with Get Contents of URL](https://support.apple.com/en-ie/guide/shortcuts/apd58d46713f/ios)
- [GitHub: Repository Contents API](https://docs.github.com/en/rest/repos/contents?apiVersion=2022-11-28)

