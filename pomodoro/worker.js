// Deadline calculations remain in the app; the worker only supplies wake-up signals.
setInterval(()=>postMessage('tick'),500);
