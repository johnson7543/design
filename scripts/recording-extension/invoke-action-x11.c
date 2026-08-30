#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

typedef struct _XDisplay Display;
typedef unsigned long Window;
typedef unsigned long Time;
typedef unsigned long KeySym;
typedef unsigned long Atom;
typedef unsigned char KeyCode;
typedef int Bool;

typedef struct {
  int type;
  unsigned long serial;
  Bool send_event;
  Display *display;
  Window window;
  Atom message_type;
  int format;
  union {
    char bytes[20];
    short shorts[10];
    long longs[5];
  } data;
} XClientMessageEvent;

typedef union {
  int type;
  XClientMessageEvent client_message;
  long padding[24];
} XEvent;

extern Display *XOpenDisplay(const char *display_name);
extern int XCloseDisplay(Display *display);
extern Window XDefaultRootWindow(Display *display);
extern int XQueryTree(
  Display *display,
  Window window,
  Window *root_return,
  Window *parent_return,
  Window **children_return,
  unsigned int *child_count_return
);
extern int XFree(void *data);
extern Atom XInternAtom(Display *display, const char *atom_name, Bool only_if_exists);
extern int XGetWindowProperty(
  Display *display,
  Window window,
  Atom property,
  long offset,
  long length,
  Bool should_delete,
  Atom requested_type,
  Atom *actual_type_return,
  int *actual_format_return,
  unsigned long *item_count_return,
  unsigned long *bytes_after_return,
  unsigned char **property_return
);
extern int XMapRaised(Display *display, Window window);
extern int XSendEvent(
  Display *display,
  Window window,
  Bool propagate,
  long event_mask,
  XEvent *event
);
extern int XFlush(Display *display);
extern int XSync(Display *display, Bool discard);
extern KeySym XStringToKeysym(const char *name);
extern KeyCode XKeysymToKeycode(Display *display, KeySym keysym);
extern Bool XTestFakeKeyEvent(
  Display *display,
  unsigned int keycode,
  Bool is_press,
  unsigned long delay
);

static Window find_window(
  Display *display,
  Window window,
  Atom pid_atom,
  unsigned long target_pid
) {
  Atom actual_type = 0;
  int actual_format = 0;
  unsigned long item_count = 0;
  unsigned long bytes_after = 0;
  unsigned char *property = NULL;
  if (
    XGetWindowProperty(
      display,
      window,
      pid_atom,
      0,
      1,
      0,
      0,
      &actual_type,
      &actual_format,
      &item_count,
      &bytes_after,
      &property
    ) == 0 &&
    actual_format == 32 &&
    item_count == 1 &&
    property != NULL
  ) {
    const unsigned long window_pid = *((unsigned long *)property);
    XFree(property);
    if (window_pid == target_pid) return window;
  } else if (property != NULL) {
    XFree(property);
  }

  Window root;
  Window parent;
  Window *children = NULL;
  unsigned int child_count = 0;
  if (!XQueryTree(display, window, &root, &parent, &children, &child_count)) return 0;

  Window match = 0;
  for (unsigned int index = 0; index < child_count && match == 0; index += 1) {
    match = find_window(display, children[index], pid_atom, target_pid);
  }
  if (children != NULL) XFree(children);
  return match;
}

static int send_key(Display *display, const char *name, Bool is_press) {
  const KeySym symbol = XStringToKeysym(name);
  const KeyCode code = XKeysymToKeycode(display, symbol);
  return symbol != 0 && code != 0 && XTestFakeKeyEvent(display, code, is_press, 0);
}

int main(int argument_count, char **arguments) {
  if (argument_count < 2) {
    fputs("Usage: invoke-action-x11 <chrome-browser-pid>\n", stderr);
    return 1;
  }
  const unsigned long target_pid = strtoul(arguments[1], NULL, 10);
  Display *display = XOpenDisplay(NULL);
  if (display == NULL) {
    fputs("Could not connect to the X11 display.\n", stderr);
    return 1;
  }

  const Atom pid_atom = XInternAtom(display, "_NET_WM_PID", 0);
  const Window window = find_window(
    display,
    XDefaultRootWindow(display),
    pid_atom,
    target_pid
  );
  if (window == 0) {
    fprintf(stderr, "Could not find the Chrome window for process %lu.\n", target_pid);
    XCloseDisplay(display);
    return 2;
  }

  const Window root = XDefaultRootWindow(display);
  const Atom active_window_atom = XInternAtom(display, "_NET_ACTIVE_WINDOW", 0);
  XEvent active_window_event = {0};
  active_window_event.client_message.type = 33;
  active_window_event.client_message.display = display;
  active_window_event.client_message.window = window;
  active_window_event.client_message.message_type = active_window_atom;
  active_window_event.client_message.format = 32;
  active_window_event.client_message.data.longs[0] = 1;
  active_window_event.client_message.data.longs[1] = 0;

  XMapRaised(display, window);
  XSendEvent(display, root, 0, (1L << 20) | (1L << 19), &active_window_event);
  XSync(display, 0);
  usleep(240000);

  const int success =
    send_key(display, "Control_L", 1) &&
    send_key(display, "Shift_L", 1) &&
    send_key(display, "Y", 1) &&
    send_key(display, "Y", 0) &&
    send_key(display, "Shift_L", 0) &&
    send_key(display, "Control_L", 0);
  XFlush(display);
  usleep(120000);
  XCloseDisplay(display);
  return success ? 0 : 3;
}
