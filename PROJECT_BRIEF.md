
# MVP Goal
An app that lets me review images from a camera connected as a card reader, highlight the ones to keep and in the end transfer all of them into a target folder.

# User flow
1. Connect camera and open folder with jpegs
2. Display first picture large. 
3. Select "keep" or "skip"
4. Automatically continue to next picture.
5. After all pictures are displayed (or "Done" is clicked) ask for a target destination to save the pictures that are marked as "keep"

# Slices
## Slice 1.
User can perform core functionality such as
- Open folder on connected camera
- "Keep" or "skip" images
- "Transfer" to destination folder
- "Exit"

## Slice 2.
Stability
- Save a file that keeps track of all selected images to pick up where I left off if app is closed

## Slice 3.
Convenience
- Auto detect connected camera and open latest folder after first connection

## Nice to haves.
Extra functionality
- Extract the core file name such that I can apply the selection of the jpeg files also in the folder for raw files
- Add function to transfer Raw files from a separate folder on the camera to a separate folder (not same as jpeg.)