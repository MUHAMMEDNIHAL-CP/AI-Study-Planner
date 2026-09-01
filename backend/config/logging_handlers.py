from logging.handlers import RotatingFileHandler


class SafeRotatingFileHandler(RotatingFileHandler):
    """RotatingFileHandler that tolerates locked files on Windows.

    Rolling over renames the log file, which fails with WinError 32 when another
    process still holds the handle (e.g. the dev server autoreloader, a second
    runserver, or antivirus). The stock handler raises on every log record, so a
    single locked file spams the console with PermissionError tracebacks.

    When rotation fails we simply keep appending to the current file so logging
    never falls over; rotation is retried on later records.
    """

    def doRollover(self):
        try:
            super().doRollover()
            return
        except OSError:
            # Rotation failed (file in use / locked). Reopen the base stream and
            # keep writing to it — appending never requires renaming the file.
            self.acquire()
            try:
                if self.stream:
                    try:
                        self.stream.close()
                    except OSError:
                        pass
                    self.stream = None
                try:
                    self.stream = self._open()
                except OSError:
                    self.stream = None
            finally:
                self.release()