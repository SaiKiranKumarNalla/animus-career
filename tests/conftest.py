import os
import tempfile

# every test run gets its own empty data folder — never the user's real one
os.environ["ANIMUS_HOME"] = tempfile.mkdtemp(prefix="animus-test-")
