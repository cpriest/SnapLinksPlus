<style>
    DIV.tutorial-inputs LABEL { padding-right: 15px; }
    DIV.tutorial-inputs INPUT { vertical-align: -2px; }
</style>

# Introduction

Thank you for giving SnapLinks v3 a try, it is currently under semi-active development (a re-write of v2). Here is a quick tutorial to get you started:

?> Snap Links lets you _"lasso" elements on a page_ and do things with them. By default, this is handled by **holding down the right mouse button and dragging a selection rectangle** around elements.<br>
<br>
It works with [links](#), image links, <input type="checkbox"> checkboxes, <input type="radio"> radio buttons, even JavaScript based links
and other "clickable" elements.

# Give it a Try

1.  Hold down the right mouse button and drag a selection around the links below.

2.  When they are highlighted, let go of the right mouse button **(then switch back to this tab)**.

    Notice how the links opened up in one or two new tabs and the first tab was switched to.

## Links

[Google](http://www.google.com), [Wikipedia](http://wikipedia.com)

  * To **open** both links in new tabs, drag a selection around the links.
  * To **copy** both links to the clipboard, drag a selection around the links, hold down the `control` key and release the mouse button.

## Checkboxes

<div class="tutorial-inputs">
    <span><label><input type="checkbox"/>Sample Checkbox 2</label></span>
    <span><label><input type="checkbox"/>Sample Checkbox 3</label></span>
    <span><label><input type="checkbox"/>Sample Checkbox 1</label></span>
</div>

?> SnapLinks will check or uncheck all checkboxes, determined by "opposite majority." So if the majority of the elements highlighted are already checked, then the checkboxes will be unchecked.

## Radio Buttons

<div class="tutorial-inputs">
    <span><label><input type="radio" name="sample" checked/>Sample Radio 1</label></span>
    <span><label><input type="radio" name="sample"/>Sample Radio 2</label></span>
    <span><label><input type="radio" name="sample"/>Sample Radio 3</label></span>
</div>


?> SnapLinks will select the highest document-order radio button highlighted.

# Behaviors
## Greatest of Types
!> You can highlight multiple types of elements at the same time but SnapLinks will only act upon one group at a time. It will act upon the group with greatest number of elements.


## Greatest Font Size
!> When highlighting a number of elements, if there is a font-size difference, SnapLinks will work with elements
with the greatest font size and filter out the rest.<br>
<br>
This can be over-ridden by holding down alt while dragging
or disabling in options.

<a href="http://www.google.com">Google</a>, <a style="font-weight: bold;" href="http://wikipedia.com">Wikipedia</a>
