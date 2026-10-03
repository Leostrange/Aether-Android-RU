# Reply Translator

Offline Aether film prop. The session simulates development of a reply translation extension.
This archive contains the reviewable design and state reducer, not a production translator.

Target language defaults to the application language. Each response owns independent loading,
ready, and error state. Original Markdown and code blocks remain visible. Cache identity combines
session ID, message ID, revision, and target language. A repeated in-flight request is ignored.
Cancellation returns to idle. Failed requests may be retried. Results never overwrite originals.
