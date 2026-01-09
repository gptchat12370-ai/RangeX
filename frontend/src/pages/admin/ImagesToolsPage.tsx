import React from "react";
import { Image, Wrench, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { DockerImagesManagement } from "./DockerImagesManagement";
import { AssetsManagement } from "./AssetsManagement";
import { ImageVariantsManagement } from "./ImageVariantsManagement";

export function ImagesToolsPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="images" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="images" className="gap-2">
            <Image className="h-4 w-4" />
            Docker Images
          </TabsTrigger>
          <TabsTrigger value="variants" className="gap-2">
            <Package className="h-4 w-4" />
            Image Variants
          </TabsTrigger>
          <TabsTrigger value="assets" className="gap-2">
            <Wrench className="h-4 w-4" />
            Assets
          </TabsTrigger>
        </TabsList>

        {/* Docker Images Tab */}
        <TabsContent value="images">
          <DockerImagesManagement />
        </TabsContent>

        {/* Image Variants Tab */}
        <TabsContent value="variants">
          <ImageVariantsManagement />
        </TabsContent>

        {/* Assets Tab */}
        <TabsContent value="assets">
          <AssetsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
