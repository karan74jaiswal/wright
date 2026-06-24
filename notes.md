# Notes

## Doubt: Why use a custom dropdown instead of `opentui`'s built-in select element for the terminal agent UI?

**Question:**
In the `cli` package's terminal UI, we use the `opentui` library. `opentui` provides a built-in select element for dropdowns, yet we implemented a custom dropdown with its own logic. What is the reasoning behind this design choice?

**Answer:**
We built a custom component to maintain simultaneous focus and synchronization between the input bar (a textarea) and the command menu dropdown.

Using `opentui`'s built-in select element requires it to be explicitly focused to capture input. If we used it for the command menu, focusing the dropdown would cause the input bar to lose focus and become inactive, breaking the synchronization between the two components.

By implementing a custom dropdown, we are able to:
1. **Maintain Sync:** Keep both the input bar and the command menu active simultaneously without shifting focus back and forth.
2. **Share State:** Use a single shared keyboard hook instance for handling keyboard interactions across both the input bar and the command menu seamlessly.

Achieving this behavior with the built-in select element would have been either impossible or resulted in unnecessarily complex and messy code.
