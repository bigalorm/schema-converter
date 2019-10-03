BigAl schema converter
================

The v2-to-v3.ts schema converter will create typescript classes based on the BigAl v2 schemas. There are some things
that need manual verification like enum values, instance functions, and beforeCreate/beforeUpdate functions.

It will create the model definitions in a sub-folder called `new`. 

Instructions
----------

* Drop v2-to-v3.ts in the folder that contains your bigal model definitions. Make sure BigAl v2 is available in the path
* Create a `new` sub-folder from the models directory
   ```bash
  mkdir new
   ``` 

* Run:
   ```bash
  npx ts-node v2-to-v3.ts
   ``` 
  
