using Microsoft.AspNetCore.StaticFiles;

var construtor = WebApplication.CreateBuilder(args);
var aplicativo = construtor.Build();
var tipos = new FileExtensionContentTypeProvider();
tipos.Mappings[".vert"] = "text/plain";
tipos.Mappings[".frag"] = "text/plain";

aplicativo.UseDefaultFiles();
aplicativo.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = tipos
});

aplicativo.Run();
