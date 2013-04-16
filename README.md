## What does this button do?

localsys is a wrapper for the (sort of) new localFileSystem async javascript api

The spec contains a sync version too, but it's much more straightforward to work with that,
so I decided to make a helper for the async methods.

## How does this work?

Just like with the native one, you need to request a file system first.
You can request a temporary or a persistent file system.

    localsys.request({
      temp: true || false,
      size: Number,
      done: function( requestedFileSystem ){

      },
      error: function( err ){

      }
      [config attributes]
    })

### Config attributes

every other attribute on this object will be considered a config value.
all of these are optional, but you can configure them with the static `.config(options)` method
or the the prototype method on the returned handler with the same name. this method will extend
the global config object with the options' values and overwrite or set properties.

    logErrors = true | false
    default: false

wether or not log errors on the console

    requestQuotaSize = Number
    default: 0

this affects the quota requested again, in case an operation exceeds the granted size

    requestQuotaFileSize = true | false
    default: false

if a file upload exceeds the size if the granted bytes, this extends the quota with the filesize

Throughout this doc, I'm gonna refer to the returned file system handler as `local`

    localsys.request({
      temp: true,
      size: 1024*1024*10,
      done: function( local, e ){

      }
    })

You may noticed, I merged the error and success callbacks, you can do this with every method.
In case of an error, if an error handler present, it will be called,
if not and if a success callback is present, its second argument will be the error.

### Files

#### Reading a file

Path can be a `DirectoryEntry` too

    local.read({
      path: "/path/to/file.json",
      done: function( result, e ){

      }
    })



#### Reading a file from a specified source

source can also be a `DirectoryEntry`

    local.read({
      source: "/base/dir",
      path: "subdir/file.json",
      done: function( result, e ){

      }
    })


#### Reading more files at once

To read an entire dir, omit the file from the end of the path,
or set the path to a `DirectoryEntry`.

    local.read({
      path: "/path/to/files",
      done: function( result, e ){

      }
    })

#### Filter directory contents

##### function

For every file in the directory, this function will be called with that `FileEntry`. If it returns false,
the file will not be included in the result set.

##### String

You can filter the filenames with a string, or set "file" or "directory" to read only files or dirs.

##### Regexp

You can filter file names with a regexp too.

    local.read({
      path: "/path/to/files",
      filter: [filter],
      done: function( result, e ){

      }
    })

#### Reading a file in a specified format

Format can be: "text", "json", "binary", "data" or "buffer".
These correlate with the options you can read a File.
Plus you can read as json, it's a convenient option.

    local.read({
      path: "/path/to/files",
      as: [format],
      done: function( result, e ){

      }
    })

#### writing to a file

Content can be:

- Blob (thus File)
- ImageData (e.g. from a canvas)
- string, number, boolean
- another FileEntry

    local.write({
      path: "/path/to/file.json",
      content: [content],
      type: "text/json",
      done: function( result, e ){

      }
    })

#### writing to more files

To make a batch write, you can give this method a `FileList` (e.g. from a form upload),
or an array of Files. In this case the file names will be the name and type will be from
the `File` instance.

Or an object where the keys are the filenames, and the values are any from the above.

    local.write({
      path: "/path/to/files",
      content: [content],
      done: function( result, e ){

      }
    })

#### appending to a file

    local.write({
      path: "/path/to/file.json",
      content: [content],
      append: true,
      done: function( result, e ){

      }
    })

#### writing without truncating

By default, writing to a file first truncates it (overwrite).
If you don't want this, you can set ˙truncate` to false.

    local.write({
      path: "/path/to/file.json",
      content: [content],
      append: true,
      done: function( result, e ){

      }
    })

#### writing to a specified position

    local.write({
      path: "/path/to/file.json",
      content: [content],
      seek: Number,
      done: function( result, e ){

      }
    })

#### removing a file

    local.remove({
      path: "/path/to/file.json",
      done: function( result, e ){

      }
    })

#### moving a file

    local.move({
      path: "/path/to/file.json",
      source: "/destination/dir",
      done: function( result, e ){

      }
    })

#### renaming a file

    local.rename({
      path: "/path/to/file.json",
      rename: "new-name.json",
      done: function( result, e ){

      }
    })

#### copying a file

    local.copy({
      path: "/path/to/file.json",
      source: "/destination/dir",
      done: function( result, e ){

      }
    })


### Directories

#### reading a directory

This is the same as the multiple file read above. If you want to obtain a `DirectoryEntry`,
simply pass ˙entry=true˙ as an option.

    local.read({
      path: "/path/to/directory",
      entry: true,
      done: function( result, e ){

      }
    })

#### reading more directories at once

    local.read({
      path: "/path/to/directory",
      filter: "directory",
      done: function( result, e ){

      }
    })

#### creating a directory

If you want an error when a directory already exists, pass the native ˙exlusive = true` as an option.

    local.createDir({
      path: "/path/to/directory",
      exclusive: true,
      done: function( result, e ){

      }
    })

#### Removing, moving, renaming and copying a directory works the same as with files.


### Checking if something exists in the file system

    local.exists({
      path: "/path/to/directory/orfile.json",
      done: function( bool ){

      }
    })

### Query the storage usage

    local.storageUsageInfo({
      done: function( used, remaining ){

      }
    })

### Reading a directory tree into an object

This one is in beta stage. But should provide an object where the keys are directory names
and the values are files.

    local.tree({
      path: "/root/directory",
      done: function( tree, e ){

      }
    })
