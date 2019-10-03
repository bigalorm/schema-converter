import { Attributes, CollectionAttribute, ModelAttribute, TypeAttribute } from 'bigal/schema/attributes';
import _ from 'lodash';
import * as fs from 'fs';
import models from "./";

async function update() {
    const modelNamesByLower: { [index: string]: string } = {};
    for (const modelName of Object.keys(models)) {
        modelNamesByLower[modelName.toLowerCase()] = modelName;
    }

    for (const [modelName, modelDef] of Object.entries(models)) {
        let header: string;
        const modelImports = [];
        const inheritModelBase = modelDef.autoCreatedAt && modelDef.autoUpdatedAt;
        const readonly = modelDef.readonly || false;

        if (inheritModelBase) {
            header = `import {
  column, //
  table,
} from 'bigal/decorators';
import { ModelBase } from './ModelBase';
`;
        } else if (modelDef.autoCreatedAt) {
            header = `import { Entity } from 'bigal';
import {
  column, //
  createDateColumn,
  primaryColumn,
  table,
} from 'bigal/decorators';
`;
        } else {
            header = `import { Entity } from 'bigal';
import {
  column, //
  primaryColumn,
  table,
} from 'bigal/decorators';
`;
        }

        let newModel = `
@table({
  name: '${modelDef.tableName || modelName.toLowerCase()}',`;

        let classExtends = inheritModelBase ? 'extends ModelBase' : 'implements Entity';

        if (modelDef.connection) {
            newModel += `\n  connection: '${modelDef.connection}',`;
        }

        if (readonly) {
            newModel += `\n  readonly: true,`;
            classExtends = '___READONLY___';
        }

        newModel += `
})
export class ${modelDef.globalId || modelName} ${classExtends} {`;

        let columns = '';
        const staticFunctions: string[] = [];
        const instanceFunctions: string[] = [];

        for (const [attribute, attributeAttributes] of Object.entries(modelDef.attributes as Attributes)) {
            if (attribute === 'id') {
                if (!inheritModelBase) {
                    columns += `

  @primaryColumn({ type: 'string' })
  public id!: string;`;
                }
            } else if (attribute === 'createdAt') {
                if (!inheritModelBase) {
                    columns += `

  @createDateColumn({
    type: 'datetime',
    name: 'created_at',
  })
  public createdAt!: Date;`;
                }
            } else if (attribute === 'updatedAt') {
                if (!inheritModelBase) {
                    columns += `

  @updateDateColumn({
    type: 'datetime',
    name: 'updated_at',
  })
  public updatedAt!: Date;`;
                }
            } else if (_.isFunction(attributeAttributes)) {
                if (attribute === 'beforeCreate' || attribute === 'beforeUpdate') {
                    staticFunctions.push(`  public static ${attributeAttributes.toString()}`);
                } else {
                    instanceFunctions.push(`  public ${attributeAttributes.toString()}`);
                }
            } else {
                columns += `

  @column({`;

                if ((attributeAttributes as ModelAttribute).model) {
                    const relatedModelName = modelNamesByLower[(attributeAttributes as ModelAttribute).model.toLowerCase()];
                    columns += `\n    model: () => ${relatedModelName}.name,`;
                    modelImports.push(relatedModelName);
                }

                if ((attributeAttributes as TypeAttribute).enum) {
                    // @ts-ignore
                    columns += `\n    enum: [${(attributeAttributes as TypeAttribute).enum.map((value) => `'${value}'`).join(', ')}] ___TODO____,`;
                }

                if ((attributeAttributes as CollectionAttribute).collection) {
                    const relatedModelName = modelNamesByLower[(attributeAttributes as CollectionAttribute).collection.toLowerCase()];
                    columns += `\n    collection: () => ${relatedModelName}.name,`;
                    modelImports.push(relatedModelName);
                }

                if ((attributeAttributes as CollectionAttribute).through) {
                    // @ts-ignore
                    const relatedModelName = modelNamesByLower[(attributeAttributes as CollectionAttribute).through.toLowerCase()];
                    columns += `\n    through: () => ${relatedModelName}.name,`;
                    modelImports.push(relatedModelName);
                }

                if ((attributeAttributes as CollectionAttribute).via) {
                    columns += `\n    via: '${(attributeAttributes as CollectionAttribute).via}',`;
                }

                if ((attributeAttributes as TypeAttribute).required) {
                    columns += `\n    required: true,`;
                }

                if (!_.isUndefined((attributeAttributes as TypeAttribute).defaultsTo)) {
                    if (typeof (attributeAttributes as TypeAttribute).defaultsTo === 'string') {
                        columns += `\n    defaultsTo: '${(attributeAttributes as TypeAttribute).defaultsTo}',`;
                    } else if (typeof (attributeAttributes as TypeAttribute).defaultsTo === 'function') {
                        // @ts-ignore
                        columns += `\n    ${(attributeAttributes as TypeAttribute).defaultsTo.toString()},`;
                    } else if (Array.isArray((attributeAttributes as TypeAttribute).defaultsTo)) {
                        // @ts-ignore
                        columns += `\n    defaultsTo: ${JSON.stringify((attributeAttributes as TypeAttribute).defaultsTo)},`;
                    } else {
                        // @ts-ignore
                        columns += `\n    defaultsTo: ${(attributeAttributes as TypeAttribute).defaultsTo.toString()},`;
                    }
                }

                if ((attributeAttributes as TypeAttribute).type) {
                    if ((attributeAttributes as TypeAttribute).type === 'date') {
                        columns += `\n    type: 'datetime',`;
                    } else if ((attributeAttributes as TypeAttribute).type === 'array') {
                        columns += `\n    type: 'string[]',`;
                    } else {
                        columns += `\n    type: '${(attributeAttributes as TypeAttribute).type}',`;
                    }
                }

                if ((attributeAttributes as TypeAttribute).columnName && ((attributeAttributes as TypeAttribute).columnName !== attribute || _.snakeCase(attribute) !== attribute)) {
                    columns += `\n    name: '${(attributeAttributes as TypeAttribute).columnName}',`;
                }

                columns += `
  })`;

                if ((attributeAttributes as TypeAttribute).type && (attributeAttributes as TypeAttribute).type.toLowerCase() === 'json') {
                    columns += `\n  // eslint-disable-next-line @typescript-eslint/no-explicit-any`;
                }

                columns += `\n  public ${attribute}`;

                const { collection } = attributeAttributes as CollectionAttribute;
                const { type, defaultsTo } = attributeAttributes as TypeAttribute;

                if ((attributeAttributes as ModelAttribute).model || (attributeAttributes as ModelAttribute).collection || (type && type !== 'array' && !type.endsWith('[]') && _.isNil(defaultsTo))) {
                    if ((attributeAttributes as TypeAttribute).required || (!_.isNil(defaultsTo) && type)) {
                        columns += '!';
                    } else {
                        columns += '?';
                    }
                }

                columns += `: `;

                if ((attributeAttributes as ModelAttribute).model) {
                    columns += `string | ${modelNamesByLower[(attributeAttributes as ModelAttribute).model.toLowerCase()]};`;
                } else if ((attributeAttributes as TypeAttribute).enum) {
                    // @ts-ignore
                    columns += `${(attributeAttributes as TypeAttribute).enum.map((val: string) => `'${val}'`).join(' | ')};`;
                } else if (collection) {
                    columns += `${modelNamesByLower[collection.toLowerCase()]}[];`;
                } else if (type) {
                    switch (type.toLowerCase()) {
                        case 'integer':
                        case 'float':
                            columns += 'number';
                            break;
                        case 'date':
                        case 'datetime':
                            columns += 'Date';
                            break;
                        case 'string':
                            columns += 'string';
                            break;
                        case 'boolean':
                            columns += 'boolean';
                            break;
                        case 'json':
                            columns += 'any';
                            break;
                        case 'binary':
                            columns += 'string';
                            break;
                        case 'array':
                        case 'string[]':
                            columns += 'string[] = []';
                            break;
                        default:
                            columns += '__UNKNOWN__';
                            break;
                    }

                    columns += ';';
                } else {
                    columns += '__UNKNOWN__;';
                }
            }
        }

        if (modelDef.beforeCreate) {
            staticFunctions.push(`  public static ${modelDef.beforeCreate.toString()}`);
        }

        if (modelDef.beforeUpdate) {
            staticFunctions.push(`  public static ${modelDef.beforeUpdate.toString()}`);
        }

        if (staticFunctions.length) {
            newModel += '\n';
            newModel += staticFunctions.join('\n\n');
        }

        newModel += columns;

        if (instanceFunctions.length) {
            newModel += '\n\n';
            newModel += instanceFunctions.join('\n\n');
        }

        newModel += `
}
`;

        let hasImports = false;
        for (const modelImport of _.uniq(modelImports.sort())) {
            if (modelImport !== modelName) {
                header += `\nimport { ${modelImport} } from './${modelImport}';`;
                hasImports = true;
            }
        }

        if (hasImports) {
            header += '\n';
        }

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (!fs.existsSync(`./new/${modelName}.ts`)) {
            // eslint-disable-next-line security/detect-non-literal-fs-filename
            fs.writeFileSync(`./new/${modelName}.ts`, `${header}${newModel}`);
        }
        console.log(`Processed: ${modelName}`);
    }
}

update().catch(console.error);
