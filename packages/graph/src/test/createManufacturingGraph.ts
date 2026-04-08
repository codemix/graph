import { StandardSchemaV1 } from "@standard-schema/spec";
import { Graph } from "../Graph.js";
import { GraphSchema } from "../GraphSchema.js";
import {
  InMemoryGraphStorage,
  StoredEdge,
  StoredVertex,
} from "../GraphStorage.js";

function makeType<T>(_defaultValue: T): StandardSchemaV1<T> {
  return {
    "~standard": {
      version: 1,
      vendor: "codemix",
      validate: (value) => {
        return { value: value as T };
      },
    },
  };
}

export function createManufacturingGraph() {
  const schema = {
    vertices: {
      Concept: {
        properties: {
          name: {
            type: makeType(undefined as undefined | string),
          },
          description: {
            type: makeType<string>(""),
          },
        },
      },
      Property: {
        properties: {
          name: {
            type: makeType<string>(""),
          },
          description: {
            type: makeType<string>(""),
          },
          cardinality: {
            type: makeType<"one" | "many">("one"),
          },
          presence: {
            type: makeType<"optional" | "required">("optional"),
          },
          uniqueness: {
            type: makeType<"none" | "global" | "local">("none"),
          },
          mutability: {
            type: makeType<"mutable" | "immutable">("mutable"),
          },
          constraints: {
            type: makeType<string[]>([]),
          },
        },
      },
      DataType: {
        properties: {
          name: {
            type: makeType<string>(""),
          },
          description: {
            type: makeType<string>(""),
          },
          schema: {
            type: makeType<any>({ type: "string" }),
          },
        },
      },
      Command: {
        properties: {
          name: {
            type: makeType<string>(""),
          },
          description: {
            type: makeType<string>(""),
          },
          predicates: {
            type: makeType<string[]>([]),
          },
        },
      },
      Event: {
        properties: {
          name: {
            type: makeType<string>(""),
          },
          description: {
            type: makeType<string>(""),
          },
        },
      },
      Effect: {
        properties: {
          name: {
            type: makeType<string>(""),
          },
          description: {
            type: makeType<string>(""),
          },
        },
      },
    },
    edges: {
      IsA: {
        properties: {},
      },
      HasProperty: {
        properties: {
          sortKey: {
            type: makeType<number>(0),
          },
        },
      },
      Uses: {
        properties: {
          sortKey: {
            type: makeType<number>(0),
          },
        },
      },
      Triggers: {
        properties: {
          sortKey: {
            type: makeType<number>(0),
          },
        },
      },
    },
  } as const satisfies GraphSchema;
  const graph = new Graph({
    schema,
    storage: new InMemoryGraphStorage(data),
  });
  return graph;
}

const data = {
  vertices: [
    {
      "@type": "Vertex",
      id: "Concept:6f182102-5437-40d0-a835-173783caaac1",
      properties: {
        name: "Facility",
        description: "A facility used in the manufacturing process.",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:727d1e6b-bb52-464d-b8d4-6d66efd7bb5d",
      properties: {
        name: "Workshop",
        description: "An empty description",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
      properties: {
        name: "Device",
        description: "An IoT device",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:8e7adfd2-122a-46d4-9d76-0f84577da8ac",
      properties: {
        name: "Thing",
        description: "An empty description",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:cc22d4e3-05c7-4a6e-9f2f-d3a9fbaf46a9",
      properties: {
        name: "Part",
        description: "An empty description",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:6502c8e9-f4b9-4931-bcbc-0b466e628161",
      properties: {
        name: "Ecobee Pro Thermostat",
        description: "An ecobee pro thermostat",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:cfb8a9a9-5158-426f-9ed0-423df7a73eba",
      properties: {
        name: "Industrial Robot",
        description:
          "Machine that can be programmed to perform various manufacturing tasks",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:4ed00d72-85a4-4275-b8ce-06f06625fc10",
      properties: {
        name: "3D Printer",
        description: "Device used for additive manufacturing",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:e8135d7d-9d9e-48ad-8e11-22f3d7f14074",
      properties: {
        name: "Thermostat",
        description: "A smart thermostat",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:9fb57e65-d4f1-4e31-b5a5-b064e6cbd516",
      properties: {
        name: "Warehouse Facility",
        description: "A large building for storing and distributing goods",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:7f8f1033-63a8-42f5-b4bb-c0a83490833d",
      properties: {
        name: "Sensor Device ",
        description:
          "A device that detects and responds to physical parameters",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:e4ae01dd-039a-4c22-9ff1-a0c578dd5f74",
      properties: {
        name: "Temperature Sensor",
        description:
          "A device that detects and responds to temperature changes",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:bc75f407-5ad9-4930-9396-1a68500d654b",
      properties: {
        name: "Motion Sensor ",
        description:
          "A device that detects and responds to movement and motion",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:b28561da-0c2c-4fac-b829-23fecf2c0fdc",
      properties: {
        name: "Humidity Sensor ",
        description: "A device that detects and responds to humidity changes",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:37b898b8-886b-45ea-bbcd-ef9b88c1c591",
      properties: {
        name: "Networking Device ",
        description:
          "A device that connects and manages computer networks and internet connectivity",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:3a03ecdf-ee2a-4424-b29c-70ee622836bb",
      properties: {
        name: "Factory",
        description: "A facility where goods are manufactured",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:58fbd96a-7a52-41a9-a3ac-8fa06abdc82c",
      properties: {
        name: "Router",
        description: "Device that connects multiple computer networks together",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:b469a5a8-fa59-46ed-8fce-74d35120515f",
      properties: {
        name: "Switch",
        description: "Device used to connect multiple devices within a network",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:0e1ecc92-5b07-40e6-92e1-bfc4b23ae864",
      properties: {
        name: "Firewall",
        description:
          "Device that controls and manages incoming and outgoing network traffic based on security rules",
      },
    },
    {
      "@type": "Vertex",
      id: "Concept:1e2392d0-f244-45f7-b89e-c8bc5210d616",
      properties: {
        name: "Supply Chain Management",
        description:
          "Process for managing the flow of goods, services, and information",
      },
    },
    {
      "@type": "Vertex",
      id: "Property:fc8e7feb-d5ba-4095-a6da-20702e8d0448",
      properties: {
        name: "Name",
        description: "The name of the part.",
        cardinality: "one",
      },
    },
    {
      "@type": "Vertex",
      id: "Property:476c3568-4f19-44f8-bfa9-fa38cc78157a",
      properties: {
        name: "Name",
        description: "Description goes here",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:0fe09c58-b196-49d8-b7f1-ff581f9ccc6a",
      properties: {
        name: "Temperature",
        description: "",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:207de056-1b69-455c-a7ea-820aab03367a",
      properties: {
        name: "Name",
        description: "Description goes here",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:1e856b3a-4e92-45d8-8baa-c861a9e7c566",
      properties: {
        name: "Color",
        description: "The colour of the attribute.",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:027d954f-6313-48ff-a5a8-ce46c4833b33",
      properties: {
        name: "Title",
        description: "The title of the thing",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:57b25e16-e9c8-41f2-99bc-05605eb1dbe9",
      properties: {
        name: "Description",
        description: "",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:436ff4c1-9bf0-4211-aa61-d0a496c47ecb",
      properties: {
        name: "test",
        description: "",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:dfa9c57c-292c-43e7-a632-251010e7ddde",
      properties: {
        name: "Namexxx",
        description: "Description goes here",
        cardinality: "many",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:79894025-6063-4957-9ff8-956ef4762c2f",
      properties: {
        name: "Name",
        description: "The name of the facility",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:dfa5efab-bc67-4c14-9dbf-7c75a8ae6487",
      properties: {
        name: "Name",
        description: "Description goes here",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:18dd1b87-4168-4f26-bc1c-2ae6adcbfc49",
      properties: {
        name: "Device Type",
        description: "Description of the device type",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:25888f29-a591-4180-964c-3a74c589687e",
      properties: {
        name: "Name",
        description: "The name of the thing.",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "Property:872d2473-576e-4542-ba7e-48a8572db984",
      properties: {
        name: "Device Location",
        description: "Physical location of the device",
        cardinality: "one",
        presence: "required",
        uniqueness: "none",
        mutability: "mutable",
        constraints: [],
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:701b9c4c-3e2b-42ab-8e79-148b82208147",
      properties: {
        name: "Production Schedule",
        description: "Schedule for production",
        schema: {
          type: "string",
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:aaf782ea-148c-4d75-b412-2785cd78df02",
      properties: {
        name: "Machine Status",
        description: "The status of a machine in the manufacturing process",
        schema: {
          type: "string",
          enum: ["Online", "Offline"],
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:da1776b1-3750-4d33-9278-55a35d683ec9",
      properties: {
        name: "Part Number",
        description: "Unique identifier for a part",
        schema: {
          type: "string",
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      properties: {
        name: "Text",
        description: "A simple text field.",
        schema: {
          type: "string",
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:48c66135-26c5-482b-8a41-55c17e36c4ba",
      properties: {
        name: "Timestamp",
        description: "A point in time recorded in a computer system",
        schema: {
          type: "string",
          format: "date-time",
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:d720b29e-669f-4aeb-9ef7-af977d16621a",
      properties: {
        name: "Project Status",
        description: "Project status in the manufacturing process",
        schema: {
          type: "string",
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:d86a0f86-7b35-4560-978f-6312bfe89a06",
      properties: {
        name: "Color",
        description: "Hexadecimal color code",
        schema: {
          type: "string",
        },
      },
    },
    {
      "@type": "Vertex",
      id: "DataType:ac790082-43a7-4983-a9cb-af39d5dda4ee",
      properties: {
        name: "Supplier Information",
        description: "Information about a supplier",
        schema: {
          type: "string",
        },
      },
    },
  ],
  edges: [
    {
      "@type": "Edge",
      id: "IsA:a5bd2d93-8193-46eb-a7bc-c7686d89edc9",
      properties: {},
      inV: "Concept:8e7adfd2-122a-46d4-9d76-0f84577da8ac",
      outV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
    },
    {
      "@type": "Edge",
      id: "IsA:4af443bf-2167-475a-b7ca-19592cbaa2dd",
      properties: {},
      inV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
      outV: "Concept:e8135d7d-9d9e-48ad-8e11-22f3d7f14074",
    },
    {
      "@type": "Edge",
      id: "IsA:097b3916-fc87-40f3-997d-c1e92d24671f",
      properties: {},
      inV: "DataType:701b9c4c-3e2b-42ab-8e79-148b82208147",
      outV: "Property:0fe09c58-b196-49d8-b7f1-ff581f9ccc6a",
    },
    {
      "@type": "Edge",
      id: "IsA:6cc6e7b3-0ef4-4e4f-a646-6a9f38dba43c",
      properties: {},
      inV: "Concept:6f182102-5437-40d0-a835-173783caaac1",
      outV: "Concept:727d1e6b-bb52-464d-b8d4-6d66efd7bb5d",
    },
    {
      "@type": "Edge",
      id: "IsA:7af88efb-a013-4625-8490-45578eb413ab",
      properties: {},
      inV: "Concept:e8135d7d-9d9e-48ad-8e11-22f3d7f14074",
      outV: "Concept:6502c8e9-f4b9-4931-bcbc-0b466e628161",
    },
    {
      "@type": "Edge",
      id: "IsA:1ed8b2db-4066-44ea-b826-41fe02aa8ce3",
      properties: {},
      inV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
      outV: "Concept:4ed00d72-85a4-4275-b8ce-06f06625fc10",
    },
    {
      "@type": "Edge",
      id: "IsA:d623cabe-41ab-48de-b838-14789dc783a6",
      properties: {},
      inV: "Concept:6f182102-5437-40d0-a835-173783caaac1",
      outV: "Concept:9fb57e65-d4f1-4e31-b5a5-b064e6cbd516",
    },
    {
      "@type": "Edge",
      id: "IsA:df444b2a-5d02-4020-804b-e409bb1029a9",
      properties: {},
      inV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
      outV: "Concept:cfb8a9a9-5158-426f-9ed0-423df7a73eba",
    },
    {
      "@type": "Edge",
      id: "IsA:32c489bb-50c0-45e7-96cc-8d23629312da",
      properties: {},
      inV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
      outV: "Concept:7f8f1033-63a8-42f5-b4bb-c0a83490833d",
    },
    {
      "@type": "Edge",
      id: "IsA:74ea6845-233d-4e5b-aec3-07e4b833bfde",
      properties: {},
      inV: "Concept:7f8f1033-63a8-42f5-b4bb-c0a83490833d",
      outV: "Concept:e4ae01dd-039a-4c22-9ff1-a0c578dd5f74",
    },
    {
      "@type": "Edge",
      id: "IsA:584af698-3b0c-48fc-9bcd-390b6c3b447d",
      properties: {},
      inV: "Concept:7f8f1033-63a8-42f5-b4bb-c0a83490833d",
      outV: "Concept:bc75f407-5ad9-4930-9396-1a68500d654b",
    },
    {
      "@type": "Edge",
      id: "IsA:454a4122-7fe2-41ad-970b-46b4f2780ce0",
      properties: {},
      inV: "Concept:7f8f1033-63a8-42f5-b4bb-c0a83490833d",
      outV: "Concept:b28561da-0c2c-4fac-b829-23fecf2c0fdc",
    },
    {
      "@type": "Edge",
      id: "IsA:4dde3851-966c-49d5-8dab-a364e2d2d809",
      properties: {},
      inV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
      outV: "Concept:37b898b8-886b-45ea-bbcd-ef9b88c1c591",
    },
    {
      "@type": "Edge",
      id: "IsA:e0fd99d4-45be-451a-8221-65f61c682671",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:18dd1b87-4168-4f26-bc1c-2ae6adcbfc49",
    },
    {
      "@type": "Edge",
      id: "IsA:63fcadb7-4681-42d7-a832-cbf6f3e0b4ac",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:25888f29-a591-4180-964c-3a74c589687e",
    },
    {
      "@type": "Edge",
      id: "IsA:215d97d7-bf99-4cf1-82ce-8e7004684546",
      properties: {},
      inV: "Concept:6f182102-5437-40d0-a835-173783caaac1",
      outV: "Concept:3a03ecdf-ee2a-4424-b29c-70ee622836bb",
    },
    {
      "@type": "Edge",
      id: "IsA:493b74b9-d037-4b50-886f-0e399d35fcdb",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:476c3568-4f19-44f8-bfa9-fa38cc78157a",
    },
    {
      "@type": "Edge",
      id: "IsA:a788fdb6-242b-441e-9531-05cca9b7f6b6",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:79894025-6063-4957-9ff8-956ef4762c2f",
    },
    {
      "@type": "Edge",
      id: "IsA:7235f41f-1c68-4cec-a735-78253708584c",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:fc8e7feb-d5ba-4095-a6da-20702e8d0448",
    },
    {
      "@type": "Edge",
      id: "IsA:3a28ce3b-1730-404f-bc61-917693ff2adb",
      properties: {},
      inV: "DataType:da1776b1-3750-4d33-9278-55a35d683ec9",
      outV: "Property:fc8e7feb-d5ba-4095-a6da-20702e8d0448",
    },
    {
      "@type": "Edge",
      id: "IsA:a3b4fd08-7c26-4204-8999-670fd8a9c332",
      properties: {},
      inV: "DataType:d86a0f86-7b35-4560-978f-6312bfe89a06",
      outV: "Property:1e856b3a-4e92-45d8-8baa-c861a9e7c566",
    },
    {
      "@type": "Edge",
      id: "IsA:8753ed96-fac1-4674-bacd-1bd48ceec475",
      properties: {},
      inV: "Concept:8e7adfd2-122a-46d4-9d76-0f84577da8ac",
      outV: "Concept:cc22d4e3-05c7-4a6e-9f2f-d3a9fbaf46a9",
    },
    {
      "@type": "Edge",
      id: "IsA:759d4d0f-e09e-4010-a72e-2a29c694003e",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:dfa5efab-bc67-4c14-9dbf-7c75a8ae6487",
    },
    {
      "@type": "Edge",
      id: "IsA:93f6a60e-42ce-4fd4-8ef7-7facab7c7571",
      properties: {},
      inV: "Concept:37b898b8-886b-45ea-bbcd-ef9b88c1c591",
      outV: "Concept:58fbd96a-7a52-41a9-a3ac-8fa06abdc82c",
    },
    {
      "@type": "Edge",
      id: "IsA:454824c9-e7b4-4574-8fea-1c94b60122fe",
      properties: {},
      inV: "Concept:37b898b8-886b-45ea-bbcd-ef9b88c1c591",
      outV: "Concept:b469a5a8-fa59-46ed-8fce-74d35120515f",
    },
    {
      "@type": "Edge",
      id: "IsA:c52d754d-1bcd-4a24-a415-1f9f5383ab79",
      properties: {},
      inV: "Concept:37b898b8-886b-45ea-bbcd-ef9b88c1c591",
      outV: "Concept:0e1ecc92-5b07-40e6-92e1-bfc4b23ae864",
    },
    {
      "@type": "Edge",
      id: "IsA:f69ce827-6690-4ebf-b572-e58cf02496f6",
      properties: {},
      inV: "DataType:f2db0872-fcc4-440a-ab48-353be2027474",
      outV: "Property:872d2473-576e-4542-ba7e-48a8572db984",
    },
    {
      "@type": "Edge",
      id: "IsA:6d216750-7b7e-47f8-9cd4-e073add07777",
      properties: {},
      inV: "Concept:6f182102-5437-40d0-a835-173783caaac1",
      outV: "Property:872d2473-576e-4542-ba7e-48a8572db984",
    },
    {
      "@type": "Edge",
      id: "HasProperty:835f0819-a475-4c9b-a1bc-4fe69843d471",
      properties: {
        sortKey: 0.9801,
      },
      inV: "Property:476c3568-4f19-44f8-bfa9-fa38cc78157a",
      outV: "Concept:6502c8e9-f4b9-4931-bcbc-0b466e628161",
    },
    {
      "@type": "Edge",
      id: "HasProperty:ef5b6d92-4661-4c35-8f9c-64d8a9a449ee",
      properties: {
        sortKey: 0.99,
      },
      inV: "Property:0fe09c58-b196-49d8-b7f1-ff581f9ccc6a",
      outV: "Concept:6502c8e9-f4b9-4931-bcbc-0b466e628161",
    },
    {
      "@type": "Edge",
      id: "HasProperty:8ed3a8e5-9a1c-4556-a2c6-9d969590dbb5",
      properties: {},
      inV: "Property:fc8e7feb-d5ba-4095-a6da-20702e8d0448",
      outV: "Concept:cc22d4e3-05c7-4a6e-9f2f-d3a9fbaf46a9",
    },
    {
      "@type": "Edge",
      id: "HasProperty:afcab29c-168a-44a8-bb6f-6385f788ae98",
      properties: {},
      inV: "Property:1e856b3a-4e92-45d8-8baa-c861a9e7c566",
      outV: "Concept:cc22d4e3-05c7-4a6e-9f2f-d3a9fbaf46a9",
    },
    {
      "@type": "Edge",
      id: "HasProperty:85200073-30a9-41e3-b651-287479476e65",
      properties: {},
      inV: "Property:79894025-6063-4957-9ff8-956ef4762c2f",
      outV: "Concept:6f182102-5437-40d0-a835-173783caaac1",
    },
    {
      "@type": "Edge",
      id: "HasProperty:c622e918-0ae7-4db5-afd0-4d68df156c22",
      properties: {},
      inV: "Property:dfa5efab-bc67-4c14-9dbf-7c75a8ae6487",
      outV: "Concept:e8135d7d-9d9e-48ad-8e11-22f3d7f14074",
    },
    {
      "@type": "Edge",
      id: "HasProperty:74c1535b-8fc8-4ce2-99c9-23215a09300c",
      properties: {
        sortKey: 0.10275290483313482,
      },
      inV: "Property:18dd1b87-4168-4f26-bc1c-2ae6adcbfc49",
      outV: "Concept:37b898b8-886b-45ea-bbcd-ef9b88c1c591",
    },
    {
      "@type": "Edge",
      id: "HasProperty:2d2299c3-f9a8-46aa-b8c0-34855f9b33fd",
      properties: {
        sortKey: 0.4102132952498967,
      },
      inV: "Property:25888f29-a591-4180-964c-3a74c589687e",
      outV: "Concept:8e7adfd2-122a-46d4-9d76-0f84577da8ac",
    },
    {
      "@type": "Edge",
      id: "HasProperty:816c6b16-ee3f-445e-987e-5ef983f292fa",
      properties: {
        sortKey: 0.13707921402903656,
      },
      inV: "Property:872d2473-576e-4542-ba7e-48a8572db984",
      outV: "Concept:48084457-27b9-4b3e-803d-8dbd1da010d0",
    },
  ],
} satisfies { vertices: StoredVertex[]; edges: StoredEdge[] };
